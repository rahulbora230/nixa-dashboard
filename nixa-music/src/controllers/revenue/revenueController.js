const {
  canAccessArtist,
  canAccessLabel,
  exportRevenue,
  getRevenueAnalytics,
  getRevenueImports,
  listRevenue,
  processRevenueFile,
  recalculateRevenue,
} = require("../../services/revenue/revenueService");

const forbidden = (res, message = "You do not have permission to perform this action.") =>
  res.status(403).json({ message });

const uploadRevenue = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return forbidden(res, "Only admins can upload revenue reports.");
    }

    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ message: "Upload at least one CSV file." });
    }

    const results = [];

    for (const file of files) {
      const result = await processRevenueFile({
        file,
        user: req.user,
        reportMonth: req.body.reportMonth,
        platform: req.body.platform,
        currency: req.body.currency,
        notes: req.body.notes,
      });

      results.push(result);
    }

    return res.status(201).json({
      message: "Revenue import completed.",
      results,
    });
  } catch (error) {
    console.error("Revenue upload error:", error);
    return res.status(500).json({ message: error.message || "Revenue upload failed." });
  }
};

const getImports = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can view import history.");
    }

    const result = await getRevenueImports({ query: req.query });
    return res.json(result);
  } catch (error) {
    console.error("Revenue imports error:", error);
    return res.status(500).json({ message: error.message || "Unable to load revenue imports." });
  }
};

const getList = async (req, res) => {
  try {
    const result = await listRevenue({ user: req.user, query: req.query });
    return res.json(result);
  } catch (error) {
    console.error("Revenue list error:", error);
    return res.status(500).json({ message: error.message || "Unable to load revenue list." });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const result = await getRevenueAnalytics({ user: req.user, query: req.query });
    return res.json(result);
  } catch (error) {
    console.error("Revenue analytics error:", error);
    return res.status(500).json({ message: error.message || "Unable to load revenue analytics." });
  }
};

const getArtistRevenue = async (req, res) => {
  try {
    const artistId = req.params.id;

    if (!(await canAccessArtist(req.user, artistId))) {
      return forbidden(res, "You can only view revenue assigned to your artist profile.");
    }

    const [analytics, list] = await Promise.all([
      getRevenueAnalytics({ user: req.user, query: req.query, forcedArtistId: artistId }),
      listRevenue({ user: req.user, query: req.query, forcedArtistId: artistId }),
    ]);

    return res.json({ analytics, ...list });
  } catch (error) {
    console.error("Artist revenue error:", error);
    return res.status(500).json({ message: error.message || "Unable to load artist revenue." });
  }
};

const getLabelRevenue = async (req, res) => {
  try {
    const labelId = req.params.id;

    if (!(await canAccessLabel(req.user, labelId))) {
      return forbidden(res, "You can only view revenue assigned to your label profile.");
    }

    const [analytics, list] = await Promise.all([
      getRevenueAnalytics({ user: req.user, query: req.query, forcedLabelId: labelId }),
      listRevenue({ user: req.user, query: req.query, forcedLabelId: labelId }),
    ]);

    return res.json({ analytics, ...list });
  } catch (error) {
    console.error("Label revenue error:", error);
    return res.status(500).json({ message: error.message || "Unable to load label revenue." });
  }
};

const recalculate = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return forbidden(res, "Only admins can recalculate revenue.");
    }

    const result = await recalculateRevenue({
      user: req.user,
      importId: req.body.importId,
      reportMonth: req.body.reportMonth,
    });

    return res.json({
      message: "Revenue recalculated.",
      result,
    });
  } catch (error) {
    console.error("Revenue recalculate error:", error);
    return res.status(500).json({ message: error.message || "Revenue recalculation failed." });
  }
};

const exportList = async (req, res) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return forbidden(res, "Only admin and accountant roles can export revenue.");
    }

    const format = req.query.format === "csv" ? "csv" : "xlsx";
    const exportResult = await exportRevenue({ user: req.user, query: req.query, format });
    const fileName = `nixa-revenue-${new Date().toISOString().slice(0, 10)}.${exportResult.extension}`;

    res.setHeader("Content-Type", exportResult.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(exportResult.buffer);
  } catch (error) {
    console.error("Revenue export error:", error);
    return res.status(500).json({ message: error.message || "Revenue export failed." });
  }
};

module.exports = {
  exportList,
  getAnalytics,
  getArtistRevenue,
  getImports,
  getLabelRevenue,
  getList,
  recalculate,
  uploadRevenue,
};
