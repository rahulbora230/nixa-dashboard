const managementService = require("../../services/management/managementService");

const listActivityLogs = async (req, res) => {
  try {
    const result = await managementService.listActivityLogs({ query: req.query });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load activity logs." });
  }
};

module.exports = {
  listActivityLogs,
};
