const express = require("express");
const { verifyToken } = require("../../middleware/authMiddleware");
const dailyAnalyticsController = require("../../controllers/daily/dailyAnalyticsController");

const router = express.Router();

router.use(verifyToken);

router.get("/overview", dailyAnalyticsController.overview);
router.get("/track/:id", dailyAnalyticsController.track);
router.get("/release/:id", dailyAnalyticsController.release);
router.get("/artist/:id", dailyAnalyticsController.artist);
router.get("/label/:id", dailyAnalyticsController.label);
router.get("/trending", dailyAnalyticsController.trending);
router.get("/export", dailyAnalyticsController.exportAnalytics);

module.exports = router;
