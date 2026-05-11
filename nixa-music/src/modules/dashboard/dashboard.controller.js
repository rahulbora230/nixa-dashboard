const service = require('./dashboard.service');

exports.getDashboard = async (req, res) => {
  try {
    const { owner_type, owner_id } = req.query;

    const balance = await service.getBalance(owner_type, owner_id);
    const summary = await service.getSummary(owner_id);
    const monthly = await service.getMonthlyTrend(owner_id);
    const platforms = await service.getPlatformStats(owner_id);
    const countries = await service.getCountryStats(owner_id);

    res.json({
      balance,
      summary,
      monthly,
      platforms,
      countries
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};