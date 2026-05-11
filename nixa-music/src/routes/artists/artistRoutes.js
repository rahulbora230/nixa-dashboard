const express = require("express");
const {
  createArtist,
  deleteArtist,
  getArtist,
  listArtists,
  updateArtist,
  updateArtistStatus,
} = require("../../controllers/artists/artistController");
const { verifyToken } = require("../../middleware/authMiddleware");
const { requireRoles } = require("../../middleware/permissions");

const router = express.Router();

router.get("/", verifyToken, requireRoles("admin", "accountant", "label", "artist"), listArtists);
router.get("/:id", verifyToken, requireRoles("admin", "accountant", "label", "artist"), getArtist);
router.post("/", verifyToken, requireRoles("admin"), createArtist);
router.put("/:id", verifyToken, requireRoles("admin"), updateArtist);
router.patch("/:id/status", verifyToken, requireRoles("admin"), updateArtistStatus);
router.delete("/:id", verifyToken, requireRoles("admin"), deleteArtist);

module.exports = router;
