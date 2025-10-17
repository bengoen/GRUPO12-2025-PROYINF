//import { Router } from 'express'
//const router = Router()
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.render('home', { title: 'Inicio' }))
router.get('/about', (req, res) => res.render('about', { title: 'About Us' }))

// Redirigir /simulate a la sección del simulador en la home
router.get('/simulate', (req, res) => res.redirect('/#simulate'))

// Página dedicada del simulador
router.get('/simulator', (req, res) => res.render('simulator', { title: 'Simulador de Préstamos' }))

// Registro (form visual) y envío (server-rendered)
const pool = require('../../db')
async function ensureApplicants() {
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

router.get('/register', (_req, res) => res.render('register', { title: 'Registro de Solicitante', flash: null }))

router.post('/register', async (req, res) => {
  const b = req.body || {}
  try {
    await ensureApplicants()
    const required = ['national_id','first_name','last_name','email','date_of_birth','address']
    for (const k of required) if (!b[k]) return res.status(400).render('register', { title: 'Registro de Solicitante', flash: `Falta ${k}` })
    const dob = new Date(b.date_of_birth)
    if (isNaN(dob.getTime())) return res.status(400).render('register', { title: 'Registro de Solicitante', flash: 'Fecha de nacimiento inválida' })
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25*24*3600*1000))
    if (age < 18) return res.status(400).render('register', { title: 'Registro de Solicitante', flash: 'Debe ser mayor de 18 años' })

    const r = await pool.query(
      `INSERT INTO applicants (
        national_id, first_name, last_name, email, phone, date_of_birth, nationality,
        address, address_proof_type, address_proof_ref,
        income_source, monthly_income, income_proof_type, income_proof_ref,
        financial_history_note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (national_id) DO UPDATE SET national_id = EXCLUDED.national_id RETURNING id`,
      [b.national_id, b.first_name, b.last_name, b.email, b.phone || null, b.date_of_birth, b.nationality || null,
       b.address, b.address_proof_type || null, b.address_proof_ref || null,
       b.income_source || null, b.monthly_income || null, b.income_proof_type || null, b.income_proof_ref || null,
       b.financial_history_note || null]
    )
    const applicantId = (r.rows && r.rows[0] && r.rows[0].id) || null
    res.render('register', { title: 'Registro de Solicitante', flash: 'Registro completado. ¡Ahora puedes simular y solicitar!', applicantId })
  } catch (err) {
    console.error(err)
    res.status(500).render('register', { title: 'Registro de Solicitante', flash: 'Error en el servidor' })
  }
})

// Login placeholder
router.get('/login', (_req, res) => res.render('login', { title: 'Ingresar' }))

//export default router
module.exports = router;
