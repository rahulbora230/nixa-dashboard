const pool = require('./src/config/db');

const run = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1️⃣ Create Artist
    const artistRes = await client.query(
      `INSERT INTO artists (artist_name)
       VALUES ('Rahul Artist')
       RETURNING id`
    );

    const artistId = artistRes.rows[0].id;

    // 2️⃣ Create Track
    const trackRes = await client.query(
      `INSERT INTO tracks 
      (isrc, title, album_name, owner_type, owner_id, release_date)
      VALUES ('INNIX1234567', 'Demo Song', 'Demo Album', 'artist', $1, '2026-01-01')
      RETURNING id`,
      [artistId]
    );

    const trackId = trackRes.rows[0].id;

    // 3️⃣ Split (85%)
    await client.query(
      `INSERT INTO splits (owner_type, owner_id, split_percent, effective_from)
       VALUES ('artist', $1, 85, '2026-01-01')`,
      [artistId]
    );

    // 4️⃣ Earnings + Ledger (multiple months)
    const months = [
      { month: '2026-01-01', revenue: 1000 },
      { month: '2026-02-01', revenue: 2000 },
      { month: '2026-03-01', revenue: 1500 },
    ];

    for (let m of months) {
      const ownerShare = m.revenue * 0.85;

      // earnings
      await client.query(
        `INSERT INTO earnings
        (track_id, owner_id, gross_amount, owner_share, nixa_share, report_month)
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          trackId,
          artistId,
          m.revenue,
          ownerShare,
          m.revenue - ownerShare,
          m.month
        ]
      );

      // ledger
      await client.query(
        `INSERT INTO ledger
        (owner_type, owner_id, entry_type, amount, description)
        VALUES ('artist', $1, 'revenue', $2, $3)`,
        [
          artistId,
          ownerShare,
          `Revenue ${m.month}`
        ]
      );
    }

    await client.query('COMMIT');

    console.log('✅ Seed data inserted!');
    console.log('👉 Artist ID:', artistId);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    process.exit();
  }
};

run();