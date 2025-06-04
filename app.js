// app.js
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes      = require('./routes/auth');
const vehiculosRoutes = require('./routes/vehiculos');
const apiRoutes       = require('./routes/api');

const app = express();

// --- Configuración de vistas ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Middlewares para parseo de body y recursos estáticos ---
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // <--- Límite ampliado
app.use(express.json({ limit: '10mb' })); // <--- Límite ampliado
app.use(express.static(path.join(__dirname, 'public')));

// --- Sesiones ---
app.use(session({
  secret: 'TU_CLAVE_SECRETA_AQUI',
  resave: false,
  saveUninitialized: false,
  // Puedes agregar store: new (require('connect-mysql')(session))({...}) si quieres sesiones en MySQL
}));

// --- Rutas de tu aplicación ---
app.use('/auth', authRoutes);           // login/logout
app.use('/vehiculos', vehiculosRoutes); // CRUD de vehículos y tickets
app.use('/api', apiRoutes);             // OCR de placas

// --- Rutas comunes ---
app.get('/',        (req, res) => res.redirect('/auth/login'));
app.get('/camara',  (req, res) => res.render('captura_placa'));

// --- Iniciar servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});

module.exports = app;
