// src/routes/loanStatus.js
const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  /**
   * GET /api/loan-requests?applicantId=#
   * Lista solicitudes (mapea term_months -> term)
   */
  router.get('/loan-requests', async (req, res) => {
    const applicantId = req.query.applicantId ? Number(req.query.applicantId) : null;
    try {
      const { rows } = await pool.query(
        `SELECT id, applicant_id, amount,
                term_months AS term,
                monthly_rate, monthly_payment,
                status, updated_at
           FROM loan_requests
          WHERE ($1::bigint IS NULL OR applicant_id = $1)
          ORDER BY updated_at DESC`,
        [applicantId]
      );
      return res.json(rows);
    } catch (err) {
      console.error('[GET /loan-requests] DB_ERROR:', err);
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  /**
   * GET /api/loan-requests/:id/status
   * Estado actual + próximas acciones
   */
  router.get('/loan-requests/:id/status', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_REQUEST' });

    try {
      const { rows } = await pool.query(
        `SELECT id, status, updated_at,
           CASE status
             WHEN 'PENDING_EVAL'    THEN ARRAY['WAIT']
             WHEN 'APPROVED'        THEN ARRAY['REVIEW_CONTRACT']
             WHEN 'REJECTED'        THEN ARRAY[]::text[]
             WHEN 'CONTRACT_PENDING' THEN ARRAY['SIGN_CONTRACT']
             WHEN 'CONTRACT_SIGNED' THEN ARRAY['REQUEST_DISBURSEMENT']
             WHEN 'ACTIVE'          THEN ARRAY['REQUEST_DISBURSEMENT']
             WHEN 'DISBURSED'       THEN ARRAY['VIEW_INSTALLMENTS']
           END AS next_actions
         FROM loan_requests
        WHERE id = $1`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.json(rows[0]);
    } catch (err) {
      console.error('[GET /loan-requests/:id/status] DB_ERROR:', err);
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  /**
   * GET /api/loan-requests/:id/timeline
   * Línea de tiempo de eventos
   */
  router.get('/loan-requests/:id/timeline', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_REQUEST' });

    try {
      const { rows } = await pool.query(
        `SELECT event_type, event_data, created_at
           FROM loan_request_events
          WHERE loan_request_id = $1
          ORDER BY created_at ASC`,
        [id]
      );
      return res.json(rows);
    } catch (err) {
      console.error('[GET /loan-requests/:id/timeline] DB_ERROR:', err);
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  /**
   * PATCH /api/loan-requests/:id/status
   * Cambia el estado y encola una notificación (mock)
   */
  router.patch('/loan-requests/:id/status', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    const allowed = [
      'PENDING_EVAL', 'APPROVED', 'REJECTED',
      'CONTRACT_PENDING', 'CONTRACT_SIGNED',
      'ACTIVE', 'DISBURSED'
    ];
    if (!Number.isFinite(id) || !allowed.includes(status)) {
      return res.status(400).json({ error: 'BAD_REQUEST', allowed });
    }

    try {
      await pool.query('BEGIN');

      // UPDATE con cast explícito al ENUM
      const upd = await pool.query(
        `UPDATE loan_requests
            SET status = $1::loan_status
          WHERE id = $2
          RETURNING id`,
        [status, id]
      );
      if (!upd.rowCount) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'NOT_FOUND' });
      }

      // Encolar notificación (casteando $2 a text para jsonb_build_object)
      await pool.query(
        `INSERT INTO notifications(loan_request_id, channel, template, payload)
         VALUES ($1, 'EMAIL', 'status_changed',
                 jsonb_build_object('newStatus', $2::text))`,
        [id, status]
      );

      await pool.query('COMMIT');
      return res.json({ ok: true });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('[PATCH /loan-requests/:id/status] DB_ERROR:', err);
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  return router;
};
