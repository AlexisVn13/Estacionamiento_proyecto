const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',          // Cambia por tu usuario
  password: '',          // Cambia por tu contraseña
  database: 'estacionamiento',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
