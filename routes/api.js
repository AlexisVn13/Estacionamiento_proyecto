// routes/api.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const tesseract = require('node-tesseract-ocr');
const db = require('../db');

// Regex para placas MX (3 letras + 3 dígitos + opcional 1 letra)
const regexPlacaMX = /^[A-Z]{3}-?\d{3}-?[A-Z]?$/;

// Configuración Tesseract CLI usando la ruta corta (evita espacios)
const ocrConfig = {
  lang: 'eng',
  oem: 1,
  psm: 7, // Single line
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  binary: 'C:\\Progra~1\\Tesseract-OCR\\tesseract.exe'
};

router.post('/reconocer', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image || image.length < 1000) {
      return res.status(400).json({ error: 'Imagen vacía o muy pequeña' });
    }

    // 1) Decodifica Base64 y guarda temporalmente
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const tmpPath = path.join(os.tmpdir(), `plate_${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, buffer);

    // 2) Ejecuta OCR en el archivo
    const text = await tesseract.recognize(tmpPath, ocrConfig);

    // 3) Elimina el archivo temporal
    fs.unlinkSync(tmpPath);

    // 4) Limpia texto y extrae posibles placas
    const limpio     = text.trim().toUpperCase().replace(/\s/g, '');
    const candidatos = limpio.match(/[A-Z0-9\-]{6,10}/g) || [];
    const placa      = candidatos.find(p => regexPlacaMX.test(p));

    if (!placa) {
      return res.status(400).json({ error: 'No se detectó una placa mexicana válida' });
    }

    // 5) Verifica duplicados (sin hora_salida)
    const [exist] = await db.query(
      'SELECT id FROM vehiculos WHERE placa = ? AND hora_salida IS NULL',
      [placa]
    );
    if (exist.length) {
      return res.status(409).json({ error: 'Vehículo ya registrado y sin salida' });
    }

    // 6) Inserta en la base de datos
    await db.query(
      'INSERT INTO vehiculos (placa, registrado_por) VALUES (?, NULL)',
      [placa]
    );

    // 7) Devuelve la placa encontrada
    res.json({ placa });
  } catch (err) {
    console.error('Error OCR/DB:', err);
    res.status(500).json({ error: 'Error interno al procesar la imagen' });
  }
});

module.exports = router;
