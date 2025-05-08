// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { usuario, contraseña } = req.body;
  const [rows] = await db.query('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);

  if (!rows.length) {
    return res.render('login', { error: 'Usuario no encontrado' });
  }
  const user = rows[0];
  const ok = await bcrypt.compare(contraseña, user.contraseña);
  if (!ok) {
    return res.render('login', { error: 'Contraseña incorrecta' });
  }
  req.session.usuarioId = user.id;
  req.session.usuario   = user.usuario;
  req.session.rol       = user.rol;
  const dest = user.rol === 'admin' ? '/vehiculos/admin' : '/vehiculos/trabajador';
  res.redirect(dest);
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

module.exports = router;
