const express = require("express");
const { verifyToken } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/marketing/smartLinkController");

const router = express.Router();

// Public marketing surfaces.
router.get("/slug/:slug", controller.getBySlug);
router.post("/:slug/click", controller.click);
router.get("/public/release/:releaseSlug", controller.publicRelease);
router.get("/public/release/:releaseSlug/:trackSlug", controller.publicRelease);
router.get("/public/artist/:artistSlug", controller.publicArtist);
router.get("/pre-save/:slug", controller.getPreSave);
router.post("/pre-save/:slug/subscribe", controller.subscribe);

// Private smart-link management and analytics.
router.get("/", verifyToken, controller.list);
router.post("/", verifyToken, controller.create);
router.get("/analytics/overview", verifyToken, controller.overview);
router.get("/release/:releaseId/kit", verifyToken, controller.promoKit);
router.post("/pre-save", verifyToken, controller.createPreSave);
router.get("/:id", verifyToken, controller.getById);
router.put("/:id", verifyToken, controller.update);
router.delete("/:id", verifyToken, controller.remove);
router.post("/:id/platforms", verifyToken, controller.addPlatformButton);
router.put("/:id/platforms/:platformId", verifyToken, controller.updatePlatformButton);
router.delete("/:id/platforms/:platformId", verifyToken, controller.removePlatformButton);
router.get("/:id/analytics", verifyToken, controller.analytics);

module.exports = router;
