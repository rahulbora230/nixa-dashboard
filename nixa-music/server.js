const express = require("express");
require("dotenv").config();
const { applySecurityMiddleware, validateEnvironment } = require("./src/middleware/security");
const { errorHandler, notFoundHandler } = require("./src/middleware/errorHandler");

const app = express();

// Validate environment first
validateEnvironment();

// Apply security middleware
applySecurityMiddleware(app);

// Body parsing with size limit
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "2mb" }));

// Static uploads with CORS headers
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static("uploads")
);

// API Routes
const revenueRoutes = require("./src/routes/revenue/revenueRoutes");
const dashboardRoutes = require("./src/modules/dashboard/dashboard.routes");
const uploadRoutes = require("./src/modules/upload/upload.routes");
const spotifyRoutes = require("./src/modules/spotify/spotify.routes");
const adminRoutes = require("./src/modules/admin/admin.routes");
const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const releaseRoutes = require("./src/modules/releases/release.routes");
const bulkMetadataRoutes = require("./src/modules/releases/bulkMetadata.routes");
const platformStatusRoutes = require("./src/modules/releases/platformStatus.routes");
const templateRoutes = require("./src/modules/releases/template.routes");
const splitRoutes = require("./src/routes/finance/splitRoutes");
const financeRoutes = require("./src/routes/finance/financeRoutes-temp");
const statementRoutes = require("./src/routes/finance/statementRoutes");
const payoutRoutes = require("./src/routes/payouts/payoutRoutes");
const invoiceRoutes = require("./src/routes/invoices/invoiceRoutes");
const artistRoutes = require("./src/routes/artists/artistRoutes");
const labelRoutes = require("./src/routes/labels/labelRoutes");
const profileRoutes = require("./src/routes/profile/profileRoutes");
const activityLogsRoutes = require("./src/routes/activityLogsRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const settingsRoutes = require("./src/routes/settingsRoutes");
const dailyReportRoutes = require("./src/routes/daily/dailyReportRoutes");
const dailyAnalyticsRoutes = require("./src/routes/daily/dailyAnalyticsRoutes");
const smartLinkRoutes = require("./src/routes/marketing/smartLinkRoutes");
const metadataFormatRoutes = require("./src/routes/metadataFormatRoutes");

// Phase 3 Finance Routes
const revenueUploadRoutes = require("./src/routes/revenue/revenueUploadRoutes");
const revenueMappingRoutes = require("./src/routes/revenue/revenueMappingRoutes");
const revenueMatchingRoutes = require("./src/routes/revenue/revenueMatchingRoutes");
const revenueSplitRoutes = require("./src/routes/revenue/revenueSplitRoutes");
const newPayoutRoutes = require("./src/routes/finance/payoutRoutes");
const exportRoutes = require("./src/routes/finance/exportRoutes");

// Root
app.get("/", (req, res) => {
  res.send("Nixa Music Backend Running");
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development"
    }
  });
});

// Direct test
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "API working", data: {} });
});

// API Routes
app.use("/api/revenue", revenueRoutes);
app.use("/api/revenue/upload", revenueUploadRoutes);
app.use("/api/revenue/mappings", revenueMappingRoutes);
app.use("/api/revenue/unmatched", revenueMatchingRoutes);
app.use("/api/revenue/splits", revenueSplitRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/spotify", spotifyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/releases", releaseRoutes);
app.use("/api/releases/bulk", bulkMetadataRoutes);
app.use("/api/releases/platform-status", platformStatusRoutes);
app.use("/api/releases/templates", templateRoutes);
app.use("/api/splits", splitRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/finance", newPayoutRoutes);
app.use("/api/finance/export", exportRoutes);
app.use("/api/statements", statementRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/artists", artistRoutes);
app.use("/api/labels", labelRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/activity-logs", activityLogsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/daily-reports", dailyReportRoutes);
app.use("/api/daily-analytics", dailyAnalyticsRoutes);
app.use("/api/smart-links", smartLinkRoutes);
app.use("/api/metadata-formats", metadataFormatRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = server;
