// src/workers/notificationWorker.js
module.exports = function startNotificationWorker(pool, logger = console) {
  async function tick() {
    try {
      const { rows } = await pool.query(
        `SELECT id, loan_request_id, channel, template, payload
           FROM notifications
          WHERE status='QUEUED'
          ORDER BY id
          LIMIT 20`
      );

      for (const n of rows) {
        logger.log(`[NOTIFY] ${n.template} via ${n.channel} for LR ${n.loan_request_id}`, n.payload);

      await pool.query(
        `INSERT INTO loan_request_events(loan_request_id, event_type, event_data)
        VALUES (
          $1,
          'NOTIFICATION_SENT',
          jsonb_build_object(
            'channel',  $2::text,
            'template', $3::text,
            'payload',  $4::jsonb
          )
        )`,
        [
          n.loan_request_id,
          n.channel,                 // e.g. 'EMAIL'
          n.template,                // e.g. 'status_changed'
          JSON.stringify(n.payload)  
        ]
      );


        await pool.query(
          `UPDATE notifications SET status='SENT', sent_at=NOW() WHERE id=$1`,
          [n.id]
        );
      }
    } catch (err) {
      logger.error('[NOTIFY] Worker error', err);
    }
  }
  const handle = setInterval(tick, 5000); // cada 5s
  logger.log('[NOTIFY] Worker started');
  return () => clearInterval(handle);
};
