const express = require("express");
const { getMyProfile, updateMyProfile } = require("../../controllers/profile/profileController");
const { verifyToken } = require("../../middleware/authMiddleware");
const { requireRoles } = require("../../middleware/permissions");

const router = express.Router();

router.get("/me", verifyToken, requireRoles("admin", "artist", "label", "accountant"), getMyProfile);
router.put("/me", verifyToken, requireRoles("admin", "artist", "label", "accountant"), updateMyProfile);

module.exports = router;
