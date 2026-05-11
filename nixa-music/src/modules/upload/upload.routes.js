const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../../config/db');
const path = require('path');

// 🔥 STORAGE
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

// 🚀 CREATE RELEASE
router.post('/release', upload.fields([
  { name: 'artwork', maxCount: 1 },
  { name: 'audio', maxCount: 10 }
]), async (req, res) => {

  try {
    const { artist_name, title, type, tracks } = req.body;

    // 🔹 ARTIST
    const artistRes = await pool.query(
      `INSERT INTO artists (name) VALUES ($1) RETURNING *`,
      [artist_name]
    );

    const artist = artistRes.rows[0];

    // 🔹 ARTWORK
    const artwork = req.files['artwork']?.[0]?.path || null;

    // 🔹 RELEASE
    const releaseRes = await pool.query(
      `INSERT INTO releases (title, artist_id, type, artwork_url)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [title, artist.id, type, artwork]
    );

    const release = releaseRes.rows[0];

    // 🔹 TRACKS
    const parsedTracks = JSON.parse(tracks);

    for (let i = 0; i < parsedTracks.length; i++) {
      const audioFile = req.files['audio']?.[i];

      await pool.query(
        `INSERT INTO tracks (release_id, title, isrc, audio_url)
         VALUES ($1,$2,$3,$4)`,
        [
          release.id,
          parsedTracks[i].title,
          parsedTracks[i].isrc,
          audioFile?.path || null
        ]
      );
    }

    res.json({ message: "Release uploaded ✅" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;