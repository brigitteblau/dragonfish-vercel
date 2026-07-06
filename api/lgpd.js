module.exports = (req, res) => {
  console.log("[lgpd] Webhook recibido", {
    method: req.method,
    query: req.query,
    body: req.body,
  });

  return res.status(200).json({
    ok: true,
    endpoint: "lgpd",
  });
};