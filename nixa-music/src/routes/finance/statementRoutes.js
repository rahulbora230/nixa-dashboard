const express = require("express");
const { verifyToken } = require("../../middleware/authMiddleware");
const statementController = require("../../controllers/finance/statementController");

const router = express.Router();

router.use(verifyToken);

router.get("/artist/:id/export/excel", (req, res) => statementController.exportArtistStatement(req, res, "excel"));
router.get("/artist/:id/export/pdf", (req, res) => statementController.exportArtistStatement(req, res, "pdf"));
router.get("/artist/:id", statementController.getArtistStatement);
router.get("/label/:id/export/excel", (req, res) => statementController.exportLabelStatement(req, res, "excel"));
router.get("/label/:id/export/pdf", (req, res) => statementController.exportLabelStatement(req, res, "pdf"));
router.get("/label/:id", statementController.getLabelStatement);

module.exports = router;
