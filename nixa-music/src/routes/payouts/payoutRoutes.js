const express = require("express");
const { verifyToken } = require("../../middleware/authMiddleware");
const payoutController = require("../../controllers/payouts/payoutController");

const router = express.Router();

router.use(verifyToken);

router.get("/dashboard", payoutController.getDashboard);
router.get("/list", payoutController.listPayouts);
router.get("/export", payoutController.exportPayouts);
router.post("/process", payoutController.processPayout);
router.get("/artist/:id", payoutController.getArtistPayouts);
router.get("/label/:id", payoutController.getLabelPayouts);
router.get("/:id", payoutController.getPayout);
router.patch("/:id/status", payoutController.updateStatus);

module.exports = router;
