const express = require("express");
const router = express.Router();
const pool = require("../../config/db");
const path = require("path");

// GET all releases
router.get("/releases", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.artwork_url,
        r.status,
        r.admin_note,
        r.created_at,
        a.name AS artist_name
      FROM releases r
      LEFT JOIN artists a ON r.artist_id = a.id
      ORDER BY r.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET tracks of release
router.get("/releases/:id/tracks", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, title, isrc, audio_url
      FROM tracks
      WHERE release_id = $1
      ORDER BY created_at ASC
      `,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve release
router.patch("/releases/:id/approve", async (req, res) => {
  try {
    await pool.query(
      `UPDATE releases SET status='approved', admin_note=NULL WHERE id=$1`,
      [req.params.id]
    );

    res.json({ message: "Release approved ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject release
router.patch("/releases/:id/reject", async (req, res) => {
  try {
    const { note } = req.body;

    await pool.query(
      `UPDATE releases SET status='rejected', admin_note=$1 WHERE id=$2`,
      [note || "Rejected by admin", req.params.id]
    );

    res.json({ message: "Release rejected ❌" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download file
router.get("/download", (req, res) => {
  const filePath = req.query.path;

  if (!filePath) {
    return res.status(400).json({ error: "File path required" });
  }

  res.download(path.resolve(filePath));
});

module.exports = router;