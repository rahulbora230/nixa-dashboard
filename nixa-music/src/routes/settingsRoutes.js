const express = require("express");
const { getSettings, updateSettings } = require("../controllers/settings/settingsController");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireRoles } = require("../middleware/permissions");

const router = express.Router();

router.get("/", verifyToken, requireRoles("admin"), getSettings);
router.put("/", verifyToken, requireRoles("admin"), updateSettings);

module.exports = router;
