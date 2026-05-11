const payoutService = require("../../services/payouts/payoutService");

const forbidden = (res, message = "You do not have permission to access payouts.") =>
  res.status(403).json({ message });

const getDashboard = async (req, res) => {
  try {
    const result = await payoutService.getPayoutDashboard({ user: req.user, query: req.query });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load payout dashboard." });
  }
};

const listPayouts = async (req, res) => {
  try {
    const result = await payoutService.listPayouts({ user: req.user, query: req.query });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load payouts." });
  }
};

const getPayout = async (req, res) => {
  try {
    const payout = await payoutService.getPayoutById({ user: req.user, id: req.params.id });

    if (!payout) {
      return res.status(404).json({ message: "Payout not found." });
    }

    return res.json({ payout });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load payout." });
  }
};

const processPayout = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can process payouts.");
    }

    const payout = await payoutService.processPayout({ user: req.user, payload: req.body });
    return res.status(201).json({ message: "Payout created.", payout });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: error.message || "Unable to process payout." });
  }
};

const updateStatus = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can change payout status.");
    }

    const payout = await payoutService.updatePayoutStatus({
      user: req.user,
      id: req.params.id,
      status: req.body.status,
      notes: req.body.notes,
    });

    if (!payout) {
      return res.status(404).json({ message: "Payout not found." });
    }

    return res.json({ message: "Payout status updated.", payout });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: error.message || "Unable to update payout status." });
  }
};

const getArtistPayouts = async (req, res) => {
  try {
    const result = await payoutService.listPayouts({
      user: req.user,
      query: req.query,
      forcedArtistId: req.params.id === "me" ? undefined : req.params.id,
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load artist payouts." });
  }
};

const getLabelPayouts = async (req, res) => {
  try {
    const result = await payoutService.listPayouts({
      user: req.user,
      query: req.query,
      forcedLabelId: req.params.id === "me" ? undefined : req.params.id,
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load label payouts." });
  }
};

const exportPayouts = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can export payouts.");
    }

    const format = req.query.format === "csv" ? "csv" : "xlsx";
    const result = await payoutService.exportPayouts({
      user: req.user,
      query: req.query,
      format,
      type: req.query.type,
    });
    const fileName = `nixa-payouts-${req.query.type || "report"}-${new Date().toISOString().slice(0, 10)}.${result.extension}`;

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(result.buffer);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to export payouts." });
  }
};

module.exports = {
  exportPayouts,
  getArtistPayouts,
  getDashboard,
  getLabelPayouts,
  getPayout,
  listPayouts,
  processPayout,
  updateStatus,
};
