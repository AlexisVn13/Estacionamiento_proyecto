const bcrypt = require('bcrypt');
const db = require('./db');

async function crearAdmin() {
  const usuario = 'admin';
  const contraseñaPlano = 'admin123';
  const rol = 'admin';

  try {
    // Verificar si ya existe
    const [rows] = await db.query('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
    if (rows.length > 0) {
      console.log('⚠️ El usuario ya existe.');
      return;
    }

    // Encriptar contraseña
    const contraseñaHash = await bcrypt.hash(contraseñaPlano, 10);

    // Insertar en la base de datos
    await db.query(
      'INSERT INTO usuarios (usuario, contraseña, rol) VALUES (?, ?, ?)',
      [usuario, contraseñaHash, rol]
    );

    console.log('✅ Usuario administrador creado con éxito.');
  } catch (error) {
    console.error('❌ Error creando usuario:', error);
  } finally {
    process.exit();
  }
}

crearAdmin();
