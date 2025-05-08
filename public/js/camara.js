document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const respuesta = document.getElementById('respuesta');
    const capturarBtn = document.getElementById('capturar');
  
    // Acceder a la cámara
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => video.srcObject = stream)
      .catch(err => console.error('Error cámara:', err));
  
    capturarBtn.addEventListener('click', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const imgData = canvas.toDataURL('image/jpeg');
  
      fetch('/api/reconocer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imgData })
      })
      .then(res => res.json())
      .then(data => {
        if (data.placa) {
          respuesta.textContent = `✅ Placa detectada: ${data.placa}`;
        } else {
          respuesta.textContent = `❌ Error: ${data.error}`;
        }
      })
      .catch(err => {
        console.error(err);
        respuesta.textContent = '❌ Error al enviar imagen';
      });
    });
  });
  