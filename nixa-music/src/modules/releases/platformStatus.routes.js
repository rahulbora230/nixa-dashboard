const express = require("express");
const pool = require("../../config/db");
const { verifyToken } = require("../../middleware/authMiddleware");
const { ensureReleaseSchema } = require("../../services/releaseSchema");

// Import service functions
const {
  getReleaseById,
  canEditRelease
} = require("./release.service");

// Import validation functions
const {
  allowedPlatforms,
  validatePlatformStatusPayload
} = require("./release.validation");

const router = express.Router();

// Apply authentication to all routes
router.use(verifyToken);

// PATCH /api/releases/:id/platform-status - Update platform-specific status
router.patch("/:id/platform-status", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    const releaseId = req.params.id;
    const { platform, status, notes } = req.body;

    const validation = validatePlatformStatusPayload({ platform, status, notes });
    if (!validation.valid) {
      return res.status(400).json({ message: validation.errors.join(", ") });
    }

    const release = await getReleaseById(releaseId);
    if (!release) {
      return res.status(404).json({ message: "Release not found." });
    }

    if (!await canEditRelease(req.user, release)) {
      return res.status(403).json({ message: "You don't have permission to update this release." });
    }

    await client.query("BEGIN");

    // Check if platform status record exists
    const existingStatus = await client.query(
      "SELECT * FROM release_platform_status WHERE release_id = $1 AND platform = $2",
      [release.id, platform.toLowerCase()]
    );

    if (existingStatus.rows.length > 0) {
      // Update existing record
      await client.query(
        `
        UPDATE release_platform_status
        SET status = $1, notes = $2, updated_by = $3, updated_at = NOW()
        WHERE release_id = $4 AND platform = $5
        `,
        [status.toLowerCase(), notes, req.user.id, release.id, platform.toLowerCase()]
      );
    } else {
      // Create new record
      await client.query(
        `
        INSERT INTO release_platform_status (release_id, platform, status, notes, created_by)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [release.id, platform.toLowerCase(), status.toLowerCase(), notes, req.user.id]
      );
    }

    // Log change
    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.platform_status', 'release', $2, $3)
      `,
      [req.user.id, release.id, JSON.stringify({ platform, status, notes })]
    );

    await client.query("COMMIT");

    res.json({ 
      message: "Platform status updated successfully.",
      platform: platform.toLowerCase(),
      status: status.toLowerCase()
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Platform status update error:", error);
    res.status(500).json({ message: error.message || "Failed to update platform status." });
  } finally {
    client.release();
  }
});

module.exports = router;
