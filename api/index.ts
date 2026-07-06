export default function handler(req: any, res: any) {
  res.setHeader("Content-Type", "text/html");

  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Dragonfish × Tiendanube</title>
      </head>

      <body style="font-family: Arial, sans-serif; padding: 2rem; background: #f7f7f7;">
        <div style="max-width: 720px; margin: auto; background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.08);">
          <h2>✅ Dragonfish × Tiendanube</h2>

          <p>
            La app está activa.
          </p>

          <p>
            El stock se sincroniza desde Dragonfish hacia Tiendanube mediante el WorkSpace y el endpoint de Vercel.
          </p>

          <hr style="margin: 1.5rem 0;" />

          <p style="font-size: 14px; color: #555;">
            Endpoint de salud:
            <a href="/api/health">/api/health</a>
          </p>
        </div>
      </body>
    </html>
  `);
}