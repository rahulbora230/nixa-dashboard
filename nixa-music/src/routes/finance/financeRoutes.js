const express = require("express");
const { verifyToken } = require("../../middleware/authMiddleware");
const financeController = require("../../controllers/finance/financeController");

const router = express.Router();

router.use(verifyToken);

router.get("/summary", financeController.getSummary);
router.get("/monthly", financeController.getMonthly);
router.get("/reports/export", financeController.exportReport);
router.get("/artist/:id", financeController.getArtist);
router.get("/label/:id", financeController.getLabel);
router.post("/recalculate", financeController.recalculate);

module.exports = router;
