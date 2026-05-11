const {
  exportDailyAnalytics,
  getDailyAnalyticsOverview,
  getEntityAnalytics,
  getTrendingAnalytics,
} = require("../../services/daily/dailyService");

const sendError = (res, error, fallback = "Request failed.") => {
  const status = error.statusCode || error.status || 500;
  return res.status(status).json({ message: error.message || fallback });
};

const overview = async (req, res) => {
  try {
    return res.json(await getDailyAnalyticsOverview({ user: req.user, query: req.query }));
  } catch (error) {
    console.error("Daily analytics overview error:", error);
    return sendError(res, error, "Unable to load daily analytics overview.");
  }
};

const track = async (req, res) => {
  try {
    return res.json(
      await getEntityAnalytics({
        user: req.user,
        entityType: "track",
        entityId: req.params.id,
        query: req.query,
      })
    );
  } catch (error) {
    console.error("Daily track analytics error:", error);
    return sendError(res, error, "Unable to load track analytics.");
  }
};

const release = async (req, res) => {
  try {
    return res.json(
      await getEntityAnalytics({
        user: req.user,
        entityType: "release",
        entityId: req.params.id,
        query: req.query,
      })
    );
  } catch (error) {
    console.error("Daily release analytics error:", error);
    return sendError(res, error, "Unable to load release analytics.");
  }
};

const artist = async (req, res) => {
  try {
    return res.json(
      await getEntityAnalytics({
        user: req.user,
        entityType: "artist",
        entityId: req.params.id,
        query: req.query,
      })
    );
  } catch (error) {
    console.error("Daily artist analytics error:", error);
    return sendError(res, error, "Unable to load artist analytics.");
  }
};

const label = async (req, res) => {
  try {
    return res.json(
      await getEntityAnalytics({
        user: req.user,
        entityType: "label",
        entityId: req.params.id,
        query: req.query,
      })
    );
  } catch (error) {
    console.error("Daily label analytics error:", error);
    return sendError(res, error, "Unable to load label analytics.");
  }
};

const trending = async (req, res) => {
  try {
    return res.json(await getTrendingAnalytics({ user: req.user, query: req.query }));
  } catch (error) {
    console.error("Daily trending analytics error:", error);
    return sendError(res, error, "Unable to load daily trend intelligence.");
  }
};

const exportAnalytics = async (req, res) => {
  try {
    if (!["admin", "accountant", "artist", "label"].includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to export analytics." });
    }

    const format = req.query.format === "csv" ? "csv" : "xlsx";
    const exportResult = await exportDailyAnalytics({ user: req.user, query: req.query, format });
    const fileName = `nixa-daily-${req.query.type || "report"}-${new Date().toISOString().slice(0, 10)}.${exportResult.extension}`;

    res.setHeader("Content-Type", exportResult.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(exportResult.buffer);
  } catch (error) {
    console.error("Daily analytics export error:", error);
    return sendError(res, error, "Daily analytics export failed.");
  }
};

module.exports = {
  artist,
  exportAnalytics,
  label,
  overview,
  release,
  track,
  trending,
};
