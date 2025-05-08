// routes/vehiculos.js
const express = require('express');
const router = express.Router();
const db = require('../db');

const PRECIO_POR_MINUTO = 1.5;

function proteger(req, res, next) {
  if (!req.session.usuarioId) return res.redirect('/auth/login');
  next();
}

// Mostrar formulario de entrada
router.get('/entrada', proteger, (req, res) => {
  res.render('entrada', { rol: req.session.rol });
});

// Procesar formulario de entrada (POST ya lo tenías)
router.post('/entrada', proteger, async (req, res) => {
  const { placa } = req.body;
  await db.query(
    'INSERT INTO vehiculos (placa, registrado_por) VALUES (?, ?)',
    [placa, req.session.usuarioId]
  );
  const redir = req.session.rol === 'admin'
    ? '/vehiculos/admin'
    : '/vehiculos/trabajador';
  res.redirect(redir);
});

// Panel admin
router.get('/admin', proteger, async (req, res) => {
  if (req.session.rol !== 'admin') return res.sendStatus(403);
  const [vehiculos] = await db.query(`
    SELECT v.*, u.usuario AS registrado_por
    FROM vehiculos v
    LEFT JOIN usuarios u ON v.registrado_por = u.id
  `);
  const [tickets] = await db.query(`
    SELECT t.*, v.placa
    FROM tickets t
    JOIN vehiculos v ON t.vehiculo_id = v.id
    ORDER BY t.fecha DESC
  `);
  res.render('admin_dashboard', { usuario: req.session.usuario, vehiculos, tickets });
});

// Panel trabajador
router.get('/trabajador', proteger, async (req, res) => {
  if (req.session.rol !== 'trabajador') return res.sendStatus(403);
  const [vehiculos] = await db.query(
    'SELECT * FROM vehiculos WHERE registrado_por = ?',
    [req.session.usuarioId]
  );
  res.render('trabajador_dashboard', { usuario: req.session.usuario, vehiculos });
});

// Registrar salida + ticket
router.post('/salida/:id', proteger, async (req, res) => {
  const vid = req.params.id;
  const [[v]] = await db.query('SELECT * FROM vehiculos WHERE id = ?', [vid]);
  if (!v) return res.status(404).send('No existe vehículo');
  const mins = Math.ceil((new Date() - new Date(v.hora_entrada)) / 60000);
  const total = parseFloat((mins * PRECIO_POR_MINUTO).toFixed(2));

  await db.query('UPDATE vehiculos SET hora_salida = ? WHERE id = ?', [new Date(), vid]);
  await db.query(
    'INSERT INTO tickets (vehiculo_id, total, pagado) VALUES (?, ?, FALSE)',
    [vid, total]
  );
  res.redirect('/vehiculos/admin');
});

// Pagar ticket
router.post('/ticket/pagar/:id', proteger, async (req, res) => {
  await db.query('UPDATE tickets SET pagado = TRUE WHERE id = ?', [req.params.id]);
  res.redirect('/vehiculos/admin');
});

module.exports = router;
