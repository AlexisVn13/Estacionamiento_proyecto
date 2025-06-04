// routes/api.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const tesseract = require('node-tesseract-ocr');
const sharp = require('sharp');
const db = require('../db');

// Configuración Tesseract optimizada para placas
const ocrConfig = {
  lang: 'eng',
  oem: 1,
  psm: 7,
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
  binary: 'C:\\Progra~1\\Tesseract-OCR\\tesseract.exe'
};

// Procesar y optimizar imagen para OCR
async function processImageForOCR(buffer) {
  try {
    const processedBuffer = await sharp(buffer)
      .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
      .greyscale()
      .normalize()
      .sharpen()
      .threshold(150)
      .jpeg({ quality: 90 })
      .toBuffer();

    // Guarda para depuración (opcional)
    const debugPath = path.join(__dirname, `../debug_img_${Date.now()}.jpg`);
    fs.writeFileSync(debugPath, processedBuffer);

    return processedBuffer;
  } catch (error) {
    console.error('Error procesando imagen:', error);
    return buffer;
  }
}

// Extrae posibles placas de texto OCR (la más flexible posible)
function extractPlateFromText(text) {
  const limpio = text.trim().toUpperCase().replace(/\s+/g, '');
  console.log('Texto OCR limpio:', limpio);

  // Patrones para placas mexicanas clásicas y tipo A00-AAA
  const patterns = [
    /[A-Z]{3}\d{3}[A-Z]?/,                // ABC123A o ABC123
    /[A-Z]{3}-\d{3}-?[A-Z]?/,             // ABC-123-A o ABC-123
    /[A-Z]{3}\s?\d{3}\s?[A-Z]?/,          // ABC 123 A o ABC 123
    /[A-Z]{1}\d{2}-[A-Z]{3}/,             // A00-AAA (nuevo)
    /[A-Z]{1}\d{2}[A-Z]{3}/,              // A00AAA (sin guion)
    /[A-Z]{1}\d{2}\-[A-Z]{3}/,            // A00-AAA (con guion)
    /[A-Z]{1}\s?\d{2}\s?\-?\s?[A-Z]{3}/   // Con espacios o guiones irregulares
  ];

  for (const pattern of patterns) {
    const matches = limpio.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Limpia guiones y espacios para guardar solo el valor útil
        const cleaned = match.replace(/[\s-]/g, '');
        // Solo valida longitud de 6 a 8 para asegurar que sea una placa realista
        if (cleaned.length >= 6 && cleaned.length <= 8) {
          return cleaned;
        }
      }
    }
  }
  return null;
}

router.post('/reconocer', async (req, res) => {
  let tmpPath = null;

  try {
    const { image } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Imagen no proporcionada o formato inválido' });
    }

    // Validar formato base64
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    console.log('Tamaño de imagen recibida:', image.length);

    // Decodificar base64
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    let buffer;

    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      return res.status(400).json({ error: 'Error decodificando imagen base64' });
    }

    if (buffer.length < 1000) {
      return res.status(400).json({ error: 'Imagen muy pequeña' });
    }

    console.log('Tamaño del buffer:', buffer.length);

    // Procesar imagen para mejorar OCR
    const processedBuffer = await processImageForOCR(buffer);

    // Guardar archivo temporal para Tesseract
    tmpPath = path.join(os.tmpdir(), `plate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`);
    fs.writeFileSync(tmpPath, processedBuffer);

    console.log('Archivo temporal creado:', tmpPath);

    // Ejecutar OCR
    let ocrText = '';
    try {
      ocrText = await tesseract.recognize(tmpPath, ocrConfig);
      console.log('Texto OCR raw:', ocrText);
    } catch (ocrError) {
      console.error('Error OCR:', ocrError);
      return res.status(500).json({ error: 'Error en el reconocimiento óptico de caracteres' });
    }

    // Extraer placa detectada
    const placaDetectada = extractPlateFromText(ocrText);

    if (!placaDetectada) {
      return res.status(400).json({
        error: 'No se detectó una placa válida',
        debug: {
          ocrText: ocrText.substring(0, 100),
          processedLength: processedBuffer.length
        }
      });
    }

    console.log('Placa detectada:', placaDetectada);

    // Verificar si ya está registrado
    const [existingVehicles] = await db.query(
      'SELECT id, hora_entrada FROM vehiculos WHERE placa = ? AND hora_salida IS NULL',
      [placaDetectada]
    );

    if (existingVehicles.length > 0) {
      return res.status(409).json({
        error: `El vehículo ${placaDetectada} ya está registrado desde ${existingVehicles[0].hora_entrada}`
      });
    }

    // Registrar entrada y controlar error de duplicado (race condition)
    try {
      await db.query(
        'INSERT INTO vehiculos (placa, registrado_por) VALUES (?, NULL)',
        [placaDetectada]
      );
    } catch (insertError) {
      // Error de clave única (por duplicado)
      if (insertError.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: `El vehículo ${placaDetectada} ya está registrado (error SQL)`
        });
      } else {
        throw insertError;
      }
    }

    console.log('Vehículo registrado exitosamente:', placaDetectada);

    // Respuesta exitosa
    res.json({
      placa: placaDetectada,
      message: 'Entrada registrada correctamente'
    });

  } catch (error) {
    console.error('Error general en /reconocer:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Limpiar archivo temporal
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
        console.log('Archivo temporal eliminado:', tmpPath);
      } catch (unlinkError) {
        console.error('Error eliminando archivo temporal:', unlinkError);
      }
    }
  }
});

module.exports = router;
