const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { verifyToken } = require("../../middleware/authMiddleware");
const dailyReportController = require("../../controllers/daily/dailyReportController");

const router = express.Router();
const uploadDir = path.resolve(process.cwd(), "uploads", "daily-reports");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    cb(null, `${Date.now()}-${base || "daily-report"}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = new Set([".csv", ".xlsx", ".xls"]);

  if (!allowed.has(ext)) {
    return cb(new Error("Only CSV, XLSX or XLS daily play reports are allowed."), false);
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 5,
    fileSize: 25 * 1024 * 1024,
  },
}).any();

const runUpload = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) {
      return next();
    }

    const message =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Daily report files must be smaller than 25 MB."
        : error.message;

    return res.status(400).json({ message });
  });
};

router.use(verifyToken);

router.post("/upload", runUpload, dailyReportController.uploadDailyReport);
router.get("/imports", dailyReportController.getImports);
router.get("/list", dailyReportController.getList);
router.get("/unmatched", dailyReportController.getUnmatched);

module.exports = router;
