const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

router.get('/', async (req, res) => {
  try {
    const { from, to, platform, artist } = req.query;

    // 🔥 dynamic WHERE
    let conditions = [];
    let values = [];

    if (from) {
      values.push(from + '-01');
      conditions.push(`report_month >= $${values.length}`);
    }

    if (to) {
      values.push(to + '-01');
      conditions.push(`report_month <= $${values.length}`);
    }

    if (platform) {
      values.push(platform);
      conditions.push(`platform = $${values.length}`);
    }

    if (artist) {
      values.push(artist);
      conditions.push(`artist_name = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // 🔥 QUERIES
    const monthly = await pool.query(`
      SELECT 
        TO_CHAR(report_month, 'YYYY-MM') AS month,
        SUM(revenue)::float AS revenue,
        SUM(streams)::float AS streams
      FROM raw_revenues
      ${where}
      GROUP BY month
      ORDER BY month
    `, values);

    const platforms = await pool.query(`
      SELECT platform, SUM(revenue)::float AS revenue
      FROM raw_revenues
      ${where}
      GROUP BY platform
      ORDER BY revenue DESC
    `, values);

    const countries = await pool.query(`
      SELECT country, SUM(revenue)::float AS revenue
      FROM raw_revenues
      ${where}
      GROUP BY country
      ORDER BY revenue DESC
      LIMIT 10
    `, values);

    const topTracks = await pool.query(`
      SELECT track_name, SUM(revenue)::float AS revenue
      FROM raw_revenues
      ${where}
      GROUP BY track_name
      ORDER BY revenue DESC
      LIMIT 5
    `, values);

    // 🔥 ARTIST ANALYTICS
    const artists = await pool.query(`
      SELECT artist_name, SUM(revenue)::float AS revenue
      FROM raw_revenues
      ${where}
      GROUP BY artist_name
      ORDER BY revenue DESC
      LIMIT 10
    `, values);

    res.json({
      monthly: monthly.rows,
      platforms: platforms.rows,
      countries: countries.rows,
      topTracks: topTracks.rows,
      artists: artists.rows
    });

  } catch (err) {
    console.error("🔥 DASHBOARD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;