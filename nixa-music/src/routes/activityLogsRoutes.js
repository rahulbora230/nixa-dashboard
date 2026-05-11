const express = require("express");
const { listActivityLogs } = require("../controllers/activity/activityLogController");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireRoles } = require("../middleware/permissions");

const router = express.Router();

router.get("/", verifyToken, requireRoles("admin"), listActivityLogs);

module.exports = router;
