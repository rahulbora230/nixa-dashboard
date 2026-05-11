const splitService = require("../../services/finance/splitService");

const forbidden = (res, message = "You do not have permission to manage splits.") =>
  res.status(403).json({ message });

const requireAdmin = (req, res) => {
  if (req.user?.role !== "admin") {
    forbidden(res, "Only admins can change split rules.");
    return false;
  }

  return true;
};

const createSplit = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) {
      return undefined;
    }

    const split = await splitService.createSplit({ payload: req.body, user: req.user });
    return res.status(201).json({ message: "Split created.", split });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to create split." });
  }
};

const listSplits = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can view split rules.");
    }

    const result = await splitService.listSplits({ query: req.query });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load splits." });
  }
};

const getSplit = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can view split rules.");
    }

    const split = await splitService.getSplitById(req.params.id);

    if (!split) {
      return res.status(404).json({ message: "Split not found." });
    }

    return res.json({ split });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load split." });
  }
};

const updateSplit = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) {
      return undefined;
    }

    const split = await splitService.replaceSplit({ id: req.params.id, payload: req.body, user: req.user });

    if (!split) {
      return res.status(404).json({ message: "Split not found." });
    }

    return res.json({ message: "Split history updated.", split });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to update split." });
  }
};

const updateStatus = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) {
      return undefined;
    }

    const split = await splitService.updateSplitStatus({ id: req.params.id, status: req.body.status });

    if (!split) {
      return res.status(404).json({ message: "Split not found." });
    }

    return res.json({ message: "Split status updated.", split });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to update split status." });
  }
};

const getHistory = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can view split history.");
    }

    const result = await splitService.getSplitHistory(req.params.artistId);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to load split history." });
  }
};

const recalculate = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) {
      return undefined;
    }

    const result = await splitService.recalculateSplits({
      user: req.user,
      reportMonth: req.body.reportMonth,
      importId: req.body.importId,
    });

    return res.json({ message: "Split recalculation complete.", result });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to recalculate splits." });
  }
};

module.exports = {
  createSplit,
  getHistory,
  getSplit,
  listSplits,
  recalculate,
  updateSplit,
  updateStatus,
};
