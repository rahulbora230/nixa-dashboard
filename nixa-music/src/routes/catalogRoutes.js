const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Get all submitted songs/albums
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        artist_name,
        label_name,
        release_title,
        release_type,
        primary_artist,
        featuring_artist,
        genre,
        language,
        release_date,
        isrc,
        upc,
        audio_file,
        artwork_file,
        status,
        created_at
      FROM catalog_submissions
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Catalog fetch error:", err);
    res.status(500).json({ message: "Failed to fetch catalog" });
  }
});

// Update status
router.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE catalog_submissions 
       SET status = $1 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

module.exports = router;