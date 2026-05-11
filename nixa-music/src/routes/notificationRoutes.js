const express = require("express");
const { listNotifications, markAllRead, markRead } = require("../controllers/notifications/notificationController");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireRoles } = require("../middleware/permissions");

const router = express.Router();

router.get("/", verifyToken, requireRoles("admin", "artist", "label", "accountant"), listNotifications);
router.patch("/read-all", verifyToken, requireRoles("admin", "artist", "label", "accountant"), markAllRead);
router.patch("/:id/read", verifyToken, requireRoles("admin", "artist", "label", "accountant"), markRead);

module.exports = router;
