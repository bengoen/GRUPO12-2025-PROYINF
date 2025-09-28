//import { Router } from 'express'
//const router = Router()
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.render('home', { title: 'Inicio' }))
router.get('/about', (req, res) => res.render('about', { title: 'About Us' }))

//export default router
module.exports = router;