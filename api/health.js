//api/health
module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    mensaje: "dragonfishXtiendanube sync activo",
    time: new Date().toISOString(),
  });
};