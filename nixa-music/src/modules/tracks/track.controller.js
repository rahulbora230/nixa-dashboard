const service = require('./track.service');

exports.createTrack = async (req, res) => {
  try {
    const data = await service.createTrack(req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTracks = async (req, res) => {
  try {
    const data = await service.getTracks();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};