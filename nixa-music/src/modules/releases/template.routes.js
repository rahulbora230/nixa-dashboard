const express = require("express");
const XLSX = require("xlsx");
const pool = require("../../config/db");
const { verifyToken } = require("../../middleware/authMiddleware");
const { ensureReleaseSchema } = require("../../services/releaseSchema");
const { buildTemplateRows, defaultMetadataFormats } = require("../../services/catalog/metadataFormats");

const router = express.Router();

// Apply authentication to all routes
router.use(verifyToken);

// GET /api/releases/templates/v1 - Download V1 metadata template
router.get("/v1", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const templateRows = buildTemplateRows("v1", defaultMetadataFormats);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Metadata V1 Template");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=metadata-v1-template.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("Template V1 download error:", error);
    res.status(500).json({ message: error.message || "Failed to generate V1 template." });
  }
});

// GET /api/releases/templates/v2 - Download V2 metadata template
router.get("/v2", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const templateRows = buildTemplateRows("v2", defaultMetadataFormats);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Metadata V2 Template");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=metadata-v2-template.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("Template V2 download error:", error);
    res.status(500).json({ message: error.message || "Failed to generate V2 template." });
  }
});

module.exports = router;
