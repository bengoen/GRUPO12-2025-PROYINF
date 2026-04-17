const express = require('express');
const router = express.Router();
const pool = require('../../db');

router.get('/', async (req, res) => {
  const { applicantId } = req.query;
  if (!applicantId) return res.status(400).json({ error: 'applicantId requerido' });

  try {
    const { rows } = await pool.query(
      `SELECT n.id, n.loan_request_id, n.channel, n.template, n.payload,
              n.status, n.created_at, n.sent_at, n.read_at, n.installment_num
         FROM notifications n
         JOIN loan_requests lr ON lr.id = n.loan_request_id
        WHERE lr.applicant_id = $1
          AND n.status IN ('SENT','QUEUED')
        ORDER BY n.created_at DESC
        LIMIT 50`,
      [applicantId]
    );

    const unreadCount = rows.filter(n => !n.read_at).length;
    res.json({ notifications: rows, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.patch('/:id/read', async (req, res) => {
  const { id } = req.params;
  const { applicantId } = req.body;
  if (!applicantId) return res.status(400).json({ error: 'applicantId requerido' });

  try {
    const { rows } = await pool.query(
      `UPDATE notifications n
          SET read_at = NOW()
         FROM loan_requests lr
        WHERE n.id = $1
          AND n.loan_request_id = lr.id
          AND lr.applicant_id = $2
          AND n.read_at IS NULL
        RETURNING n.id`,
      [id, applicantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/read-all', async (req, res) => {
  const applicantId = req.body.applicantId || req.query.applicantId;
  if (!applicantId) return res.status(400).json({ error: 'applicantId requerido' });

  try {
    const result = await pool.query(
      `UPDATE notifications n
          SET read_at = NOW()
         FROM loan_requests lr
        WHERE n.loan_request_id = lr.id
          AND lr.applicant_id = $1
          AND n.read_at IS NULL`,
      [applicantId]
    );
    res.json({ ok: true, updated: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
