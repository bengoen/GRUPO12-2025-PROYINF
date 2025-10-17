const express = require('express')
const router = express.Router()
const pool = require('../../db')

// Create table if not exists
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_requests (
      id SERIAL PRIMARY KEY,
      amount NUMERIC(12,2) NOT NULL,
      term_months INTEGER NOT NULL,
      monthly_rate NUMERIC(10,6) NOT NULL,
      monthly_payment NUMERIC(12,2) NOT NULL,
      applicant_id INTEGER,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS applicant_id INTEGER`)
}

router.post('/', async (req, res) => {
  const { amount, termMonths, monthlyRate, monthlyPayment, applicantId } = req.body || {}
  if (
    amount == null ||
    termMonths == null ||
    monthlyRate == null ||
    monthlyPayment == null
  ) {
    return res.status(400).json({ error: 'Missing fields' })
  }
  if (applicantId == null) {
    return res.status(401).json({ error: 'Debe registrarse antes de confirmar la simulación' })
  }
  try {
    await ensureTable()
    const { rows } = await pool.query(
      `INSERT INTO loan_requests (amount, term_months, monthly_rate, monthly_payment, applicant_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [amount, termMonths, monthlyRate, monthlyPayment, applicantId || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'DB error' })
  }
})

module.exports = router
