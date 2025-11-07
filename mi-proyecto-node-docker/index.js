//import express from 'express'
//import { dirname, join } from 'path'
//import { fileURLToPath } from 'url'
//import indexRoutes from './src/routes/index.js'
const express = require('express');
const path = require('path');
const pool = require('./db'); // Importar la conexión
const indexRoutes = require('./src/routes/index');
const loanStatusRouterFactory = require('./src/routes/loanStatus');
const startNotificationWorker = require('./src/workers/notificationWorker');

const app = express()
const stopWorker = startNotificationWorker(pool);

// Parse JSON and form bodies for API and web forms
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Ruta de prueba que guarda un mensaje en la base de datos
app.get('/save', async (req, res) => {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, content TEXT)');
    await pool.query('INSERT INTO messages (content) VALUES ($1)', ['Hola desde PostgreSQL!']);
    res.send('Mensaje guardado en la base de datos');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

// Ruta para obtener todos los mensajes
app.get('/messages', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM messages');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

//const __dirname = dirname(fileURLToPath(import.meta.url))
//console.log('__dirname:', __dirname)
//const __dirname = path.dirname(__filename);
console.log('__dirname:', __dirname);

const PORT = process.env.PORT || 3000;

//app.set('views', join(__dirname, 'src', 'views'))
//app.set('static', join(__dirname, 'src', 'static'))
//app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('static', path.join(__dirname, 'src', 'static'));
app.set('view engine', 'ejs');

// Serve vendor assets (React UMD) from node_modules under /vendor
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')))

app.use(indexRoutes)

// API routes for HU001
app.use('/api/loan-requests', require('./src/routes/loanRequests'))
app.use('/api/applicants', require('./src/routes/applicants'))
app.use('/api', loanStatusRouterFactory(pool));

//app.use(express.static(join(__dirname, 'src', 'public')))
app.use(express.static(path.join(__dirname, 'src', 'public')));

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});


process.on('SIGTERM', stopWorker);
process.on('SIGINT', stopWorker);

// vistas HU002
app.get('/requests', (req, res) => res.render('requests'));
app.get('/requests/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).send('id inválido');
  res.render('request_detail', { id });
});
