const express = require("express");
const {
  assignArtist,
  createLabel,
  deleteLabel,
  getLabel,
  listLabelArtists,
  listLabels,
  removeArtist,
  updateLabel,
  updateLabelStatus,
} = require("../../controllers/labels/labelController");
const { verifyToken } = require("../../middleware/authMiddleware");
const { requireRoles } = require("../../middleware/permissions");

const router = express.Router();

router.get("/", verifyToken, requireRoles("admin", "accountant", "label"), listLabels);
router.post("/", verifyToken, requireRoles("admin"), createLabel);
router.post("/:labelId/artists/:artistId", verifyToken, requireRoles("admin"), assignArtist);
router.delete("/:labelId/artists/:artistId", verifyToken, requireRoles("admin"), removeArtist);
router.get("/:labelId/artists", verifyToken, requireRoles("admin", "accountant", "label"), listLabelArtists);
router.get("/:id", verifyToken, requireRoles("admin", "accountant", "label"), getLabel);
router.put("/:id", verifyToken, requireRoles("admin"), updateLabel);
router.patch("/:id/status", verifyToken, requireRoles("admin"), updateLabelStatus);
router.delete("/:id", verifyToken, requireRoles("admin"), deleteLabel);

module.exports = router;
