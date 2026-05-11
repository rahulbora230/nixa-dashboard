const pool = require('../../config/db');

exports.createTrack = async (body) => {
  const {
    isrc,
    title,
    album_name,
    owner_type,
    owner_id,
    release_date,
    artists
  } = body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const trackRes = await client.query(
      `INSERT INTO tracks (isrc, title, album_name, owner_type, owner_id, release_date)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [isrc, title, album_name, owner_type, owner_id, release_date]
    );

    const track = trackRes.rows[0];

    // Insert artists (metadata)
    for (let name of artists) {
      await client.query(
        `INSERT INTO track_artists (track_id, artist_name)
         VALUES ($1,$2)`,
        [track.id, name]
      );
    }

    await client.query('COMMIT');
    return track;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getTracks = async () => {
  const res = await pool.query(`SELECT * FROM tracks ORDER BY created_at DESC`);
  return res.rows;
};