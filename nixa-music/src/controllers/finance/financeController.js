const financeService = require("../../services/finance/financeService");

const forbidden = (res, message = "You do not have permission to view this finance data.") =>
  res.status(403).json({ message });

const getSummary = async (req, res) => {
  try {
    const result = await financeService.getFinanceSummary({ user: req.user, query: req.query });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load finance summary." });
  }
};

const getArtist = async (req, res) => {
  try {
    const result = await financeService.getArtistFinance({
      user: req.user,
      artistId: req.params.id,
      query: req.query,
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load artist finance." });
  }
};

const getLabel = async (req, res) => {
  try {
    const result = await financeService.getLabelFinance({
      user: req.user,
      labelId: req.params.id,
      query: req.query,
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load label finance." });
  }
};

const getMonthly = async (req, res) => {
  try {
    const result = await financeService.getMonthlyFinance({ user: req.user, query: req.query });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load monthly finance." });
  }
};

const recalculate = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return forbidden(res, "Only admins can recalculate finance.");
    }

    const result = await financeService.recalculateFinance({
      user: req.user,
      reportMonth: req.body.reportMonth,
      importId: req.body.importId,
    });

    return res.json({ message: "Finance recalculation complete.", result });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to recalculate finance." });
  }
};

const exportReport = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can export finance reports.");
    }

    const format = req.query.format === "csv" ? "csv" : "xlsx";
    const result = await financeService.exportFinanceReport({
      user: req.user,
      query: req.query,
      format,
      type: req.query.type,
    });
    const fileName = `nixa-finance-${req.query.type || "report"}-${new Date().toISOString().slice(0, 10)}.${result.extension}`;

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(result.buffer);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to export finance report." });
  }
};

module.exports = {
  exportReport,
  getArtist,
  getLabel,
  getMonthly,
  getSummary,
  recalculate,
};
