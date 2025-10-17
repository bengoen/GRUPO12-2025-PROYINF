const express = require('express')
const router = express.Router()
const pool = require('../../db')

const ensureApplicants = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicants (
      id SERIAL PRIMARY KEY,
      national_id TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      date_of_birth DATE NOT NULL,
      nationality TEXT,
      address TEXT NOT NULL,
      address_proof_type TEXT,
      address_proof_ref TEXT,
      income_source TEXT,
      monthly_income NUMERIC(12,2),
      income_proof_type TEXT,
      income_proof_ref TEXT,
      financial_history_note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
}

function yearsBetween(d1, d2) {
  const diff = d2.getTime() - d1.getTime()
  const years = diff / (365.25 * 24 * 3600 * 1000)
  return Math.floor(years)
}

router.post('/', async (req, res) => {
  const b = req.body || {}
  try {
    await ensureApplicants()

    // Validaciones básicas
    const required = ['national_id','first_name','last_name','email','date_of_birth','address']
    for (const k of required) if (!b[k]) return res.status(400).json({ error: `Missing field ${k}` })

    const dob = new Date(b.date_of_birth)
    if (isNaN(dob.getTime())) return res.status(400).json({ error: 'Invalid date_of_birth' })
    const age = yearsBetween(dob, new Date())
    if (age < 18) return res.status(400).json({ error: 'Debe ser mayor de 18 años' })

    const { rows } = await pool.query(
      `INSERT INTO applicants (
        national_id, first_name, last_name, email, phone, date_of_birth, nationality,
        address, address_proof_type, address_proof_ref,
        income_source, monthly_income, income_proof_type, income_proof_ref,
        financial_history_note
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,
        $11,$12,$13,$14,
        $15
      ) RETURNING *`,
      [
        b.national_id, b.first_name, b.last_name, b.email, b.phone || null,
        b.date_of_birth, b.nationality || null,
        b.address, b.address_proof_type || null, b.address_proof_ref || null,
        b.income_source || null, b.monthly_income || null, b.income_proof_type || null, b.income_proof_ref || null,
        b.financial_history_note || null
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    if (String(err.message || '').includes('unique') || String(err.message || '').includes('duplicate')) {
      return res.status(409).json({ error: 'national_id ya registrado' })
    }
    res.status(500).json({ error: 'DB error' })
  }
})

router.get('/', async (_req, res) => {
  try {
    await ensureApplicants()
    const { rows } = await pool.query('SELECT id, national_id, first_name, last_name, email, created_at FROM applicants ORDER BY id DESC LIMIT 100')
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'DB error' }) }
})

module.exports = router

