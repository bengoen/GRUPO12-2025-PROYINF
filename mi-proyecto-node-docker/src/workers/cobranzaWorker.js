const { buildInstallmentSchedule } = require('../utils/installments');

module.exports = function startCobranzaWorker(pool, logger = console) {
  async function tick() {
    try {
      const { rows: loans } = await pool.query(
        `SELECT id, amount, term_months, monthly_rate, monthly_payment, status, created_at
           FROM loan_requests
          WHERE status IN ('ACTIVE', 'DISBURSED')`
      );

      for (const loan of loans) {
        const schedule = buildInstallmentSchedule(loan);

        let paidInstallments = new Set();
        try {
          const { rows: paid } = await pool.query(
            `SELECT installment FROM loan_installment_payments
              WHERE loan_request_id = $1 AND status IN ('AUTHORIZED','PAID')`,
            [loan.id]
          );
          paidInstallments = new Set(paid.map(r => r.installment));
        } catch (_) {}

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const row of schedule) {
          if (paidInstallments.has(row.installment)) continue;

          const due = new Date(row.dueDate);
          due.setHours(0, 0, 0, 0);
          const daysUntilDue = Math.round((due - today) / 86400000);

          let template = null;
          if (daysUntilDue === 3) template = 'installment_due_soon';
          else if (daysUntilDue === 0) template = 'installment_due_today';
          else if (daysUntilDue < 0 && daysUntilDue >= -30) template = 'installment_overdue';

          if (!template) continue;

          await pool.query(
            `INSERT INTO notifications
               (loan_request_id, channel, template, payload, status, installment_num, notification_date)
             VALUES ($1, 'EMAIL', $2,
               jsonb_build_object(
                 'installment',  $3::int,
                 'dueDate',      $4::text,
                 'totalPayment', $5::numeric,
                 'daysUntilDue', $6::int,
                 'loanId',       $1::int
               ),
               'QUEUED', $3, CURRENT_DATE)
             ON CONFLICT (loan_request_id, installment_num, notification_date)
               WHERE installment_num IS NOT NULL AND notification_date IS NOT NULL
             DO NOTHING`,
            [loan.id, template, row.installment, row.dueDate, Math.round(row.totalPayment), daysUntilDue]
          );
        }
      }
    } catch (err) {
      logger.error('[COBRANZA] Worker error', err);
    }
  }

  const handle = setInterval(tick, 60000);
  logger.log('[COBRANZA] Worker started');
  return () => clearInterval(handle);
};
