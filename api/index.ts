export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <body style="font-family: sans-serif; padding: 2rem;">
        <h2>✅ Dragonfish × Tienda Nube</h2>
        <p>Sync activo. El stock se actualiza cada 30 minutos desde Dragonfish.</p>
      </body>
    </html>
  `);
}
