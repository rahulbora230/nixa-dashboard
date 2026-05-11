const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { verifyToken } = require("../../middleware/authMiddleware");
const revenueController = require("../../controllers/revenue/revenueController");

const router = express.Router();
const uploadDir = path.resolve(process.cwd(), "uploads", "revenue");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    cb(null, `${Date.now()}-${base || "revenue"}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimeTypes = new Set([
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
    "application/octet-stream",
  ]);

  if (ext !== ".csv" || !allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error("Only CSV royalty reports are allowed."), false);
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 10,
    fileSize: 20 * 1024 * 1024,
  },
}).any();

const runUpload = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) {
      return next();
    }

    const message =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "CSV files must be smaller than 20 MB."
        : error.message;

    return res.status(400).json({ message });
  });
};

router.use(verifyToken);

router.post("/upload", runUpload, revenueController.uploadRevenue);
router.get("/imports", revenueController.getImports);
router.get("/list", revenueController.getList);
router.get("/", revenueController.getList);
router.get("/analytics", revenueController.getAnalytics);
router.get("/artist/:id", revenueController.getArtistRevenue);
router.get("/label/:id", revenueController.getLabelRevenue);
router.post("/recalculate", revenueController.recalculate);
router.get("/export", revenueController.exportList);
router.get("/test", (req, res) => {
  res.json({ message: "Revenue route working", user: req.user.role });
});

module.exports = router;
