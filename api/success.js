export default function handler(req, res) {
  const { key } = req.query;
  
  if (!key) {
    return res.status(400).send("Missing license key.");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Successful - AI Fighter</title>
      <style>
        body { font-family: -apple-system, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: white; }
        .key-box { background: #262640; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 24px; margin: 20px auto; max-width: 400px; word-break: break-all; }
        .instruction { font-size: 16px; color: #ccc; }
      </style>
    </head>
    <body>
      <h1>Payment Successful! 🎉</h1>
      <p class="instruction">Please copy your license key below and paste it into the AI Fighter extension popup:</p>
      <div class="key-box">${key}</div>
      <p class="instruction">Your account has been credited with 800 Deep Scans.</p>
      <p class="instruction">You can safely close this window.</p>
    </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
