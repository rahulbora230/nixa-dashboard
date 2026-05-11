const {
  getDailyReportImports,
  getUnmatchedRows,
  listDailyRecords,
  processDailyReportFile,
} = require("../../services/daily/dailyService");

const forbidden = (res, message = "You do not have permission to perform this action.") =>
  res.status(403).json({ message });

const uploadDailyReport = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return forbidden(res, "Only admins can upload daily play reports.");
    }

    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ message: "Upload at least one CSV or Excel daily play report." });
    }

    const results = [];

    for (const file of files) {
      const result = await processDailyReportFile({
        file,
        user: req.user,
        platform: req.body.platform,
        reportDate: req.body.reportDate,
      });

      results.push(result);
    }

    return res.status(201).json({
      message: "Daily play report import completed.",
      results,
    });
  } catch (error) {
    console.error("Daily report upload error:", error);
    return res.status(500).json({ message: error.message || "Daily report upload failed." });
  }
};

const getImports = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admins and accountants can view daily report imports.");
    }

    return res.json(await getDailyReportImports({ query: req.query }));
  } catch (error) {
    console.error("Daily report imports error:", error);
    return res.status(500).json({ message: error.message || "Unable to load daily report imports." });
  }
};

const getList = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admins and accountants can view raw daily report rows.");
    }

    return res.json(await listDailyRecords({ user: req.user, query: req.query, includeUnmatched: true }));
  } catch (error) {
    console.error("Daily report list error:", error);
    return res.status(500).json({ message: error.message || "Unable to load daily report rows." });
  }
};

const getUnmatched = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admins and accountants can view unmatched ISRC rows.");
    }

    return res.json(await getUnmatchedRows({ query: req.query }));
  } catch (error) {
    console.error("Daily report unmatched error:", error);
    return res.status(500).json({ message: error.message || "Unable to load unmatched ISRC report." });
  }
};

module.exports = {
  getImports,
  getList,
  getUnmatched,
  uploadDailyReport,
};
