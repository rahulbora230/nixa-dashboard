const express = require("express");
const { verifyToken } = require("../../middleware/authMiddleware");
const splitController = require("../../controllers/finance/splitController");

const router = express.Router();

router.use(verifyToken);

router.post("/", splitController.createSplit);
router.get("/", splitController.listSplits);
router.get("/history/:artistId", splitController.getHistory);
router.post("/recalculate", splitController.recalculate);
router.get("/:id", splitController.getSplit);
router.put("/:id", splitController.updateSplit);
router.patch("/:id/status", splitController.updateStatus);

module.exports = router;
