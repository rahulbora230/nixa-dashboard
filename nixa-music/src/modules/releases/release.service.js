const pool = require("../../config/db");
const { ensureReleaseSchema } = require("../../services/releaseSchema");
const { phase9Statuses } = require("./release.validation");
const {
  buildQcReport,
  calculateReleaseCompletion,
  calculateTrackCompletion,
  generateIsrc,
  normalizeMetadataStatus,
  slugify,
  toArray,
} = require("../../services/catalog/catalogEngine");

const getReleaseById = async (id) => {
  const releaseResult = await pool.query(
    `
    SELECT
      r.*,
      af.file_path AS artwork_file_path,
      af.file_name AS artwork_file_name,
      af.mime_type AS artwork_mime_type,
      af.size AS artwork_size
    FROM releases r
    LEFT JOIN LATERAL (
      SELECT COALESCE(file_path, file_url) AS file_path, file_name, mime_type, size
      FROM release_files
      WHERE release_id = r.id AND file_type = 'artwork'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) af ON true
    WHERE r.id::text = $1
       OR r.permalink_slug = $1
       OR LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(r.release_title, r.title, ''), '[^a-zA-Z0-9]+', '-', 'g'))) = $1
       OR EXISTS (
          SELECT 1
          FROM tracks tx
          WHERE tx.release_id = r.id
            AND (
              tx.id::text = $1
              OR LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(tx.song_name, tx.title, tx.isrc, ''), '[^a-zA-Z0-9]+', '-', 'g'))) = $1
            )
       )
    `,
    [id]
  );

  return releaseResult.rows[0] || null;
};

const getTracksByReleaseId = async (releaseId) => {
  const result = await pool.query(
    `
    SELECT
      *,
      COALESCE(title, song_name) AS title,
      COALESCE(audio_file_path, audio_url) AS audio_file_path
    FROM tracks
    WHERE release_id = $1
    ORDER BY id ASC
    `,
    [releaseId]
  );

  return result.rows;
};

const getReleaseScope = async (user) => {
  if (["admin", "accountant"].includes(user.role)) {
    return { clause: "", values: [] };
  }

  if (user.role === "artist") {
    const values = [];
    const checks = [];

    if (isIntegerId(user.id)) {
      values.push(Number(user.id));
      checks.push(`r.user_id = $${values.length}`);
    }

    const tableCheck = await pool.query("SELECT to_regclass('public.artists') AS artists_table");

    if (tableCheck.rows[0]?.artists_table) {
      const artistResult = await pool.query("SELECT id, artist_name FROM artists WHERE user_id::text = $1", [String(user.id)]);
      const artistIds = artistResult.rows.map((row) => row.id).filter(Boolean);
      const artistNames = artistResult.rows.map((row) => row.artist_name).filter(Boolean);

      if (artistIds.length) {
        values.push(artistIds);
        checks.push(`r.artist_id = ANY($${values.length}::uuid[])`);
      }

      if (artistNames.length) {
        values.push(artistNames);
        checks.push(`r.primary_artist = ANY($${values.length}::text[])`);
      }
    }

    return {
      clause: checks.length ? `(${checks.join(" OR ")})` : "FALSE",
      values,
    };
  }

  if (user.role !== "label") {
    return { clause: "FALSE", values: [] };
  }

  const values = [];
  const checks = [];

  if (isIntegerId(user.id)) {
    values.push(Number(user.id));
    checks.push(`r.user_id = $${values.length}`);
  }

  const tableCheck = await pool.query(`
    SELECT 
      to_regclass('public.labels') AS labels_table,
      to_regclass('public.artists') AS artists_table,
      to_regclass('public.artist_label_map') AS map_table
  `);
  const tables = tableCheck.rows[0] || {};

  if (tables.labels_table) {
    const labelResult = await pool.query("SELECT id, COALESCE(label_name, name) AS name FROM labels WHERE user_id::text = $1", [String(user.id)]);
    const labelIds = labelResult.rows.map((row) => row.id).filter(Boolean);
    const labelNames = labelResult.rows.map((row) => row.name).filter(Boolean);

    if (labelNames.length) {
      values.push(labelNames);
      checks.push(`r.label_name = ANY($${values.length}::text[])`);
    }

    if (tables.map_table && tables.artists_table && labelIds.length) {
      const artistResult = await pool.query(
        `
        SELECT DISTINCT alm.artist_id, a.artist_name
        FROM artist_label_map alm
        LEFT JOIN artists a ON a.id = alm.artist_id
        WHERE alm.label_id = ANY($1::uuid[])
        `,
        [labelIds]
      );
      const artistIds = artistResult.rows.map((row) => row.artist_id).filter(Boolean);
      const artistNames = artistResult.rows.map((row) => row.artist_name).filter(Boolean);

      if (artistIds.length) {
        values.push(artistIds);
        checks.push(`r.artist_id = ANY($${values.length}::uuid[])`);
      }

      if (artistNames.length) {
        values.push(artistNames);
        checks.push(`r.primary_artist = ANY($${values.length}::text[])`);
      }
    }
  }

  return {
    clause: checks.length ? `(${checks.join(" OR ")})` : "FALSE",
    values,
  };
};

const canReadRelease = async (user, release) => {
  if (!release) {
    return false;
  }

  if (["admin", "accountant"].includes(user.role)) {
    return true;
  }

  if (getLegacyUserId(user) && Number(release.user_id) === getLegacyUserId(user)) {
    return true;
  }

  if (release.created_by && String(release.created_by) === String(user.id)) {
    return true;
  }

  if (!["artist", "label"].includes(user.role)) {
    return false;
  }

  const scope = await getReleaseScope(user);
  if (!scope.clause) {
    return false;
  }

  const values = [...scope.values, release.id];
  const check = await pool.query(
    `SELECT 1 FROM releases r WHERE ${scope.clause} AND r.id = $${values.length} LIMIT 1`,
    values
  );

  return check.rows.length > 0;
};

const canEditRelease = async (user, release) => {
  if (user.role === "admin") {
    return true;
  }

  if (user.role === "accountant") {
    return false;
  }

  // Allow editing of drafts by owners and creators
  if (release.status === "draft") {
    return canReadRelease(user, release);
  }

  // Allow editing of "updated" status releases
  if (release.status === "updated") {
    if (getLegacyUserId(user) && Number(release.user_id) === getLegacyUserId(user)) {
      return true;
    }
    return canReadRelease(user, release);
  }

  return false;
};

const canEditMetadata = async (user, release) => {
  if (user.role === "admin") {
    return true;
  }

  if (!["artist", "label"].includes(user.role)) {
    return false;
  }

  if (!["draft", "updated"].includes(release.status)) {
    return false;
  }

  return canReadRelease(user, release);
};

const formatReleaseResponse = (release, tracks = []) => ({
  ...release,
  release_title: release.release_title || release.title,
  permalink_slug: release.permalink_slug || slugify(release.release_title || release.title || release.id),
  release_url: `/release/${release.permalink_slug || slugify(release.release_title || release.title || release.id)}`,
  artwork_url: release.artwork_file_path ? `/${release.artwork_file_path.replace(/^\/+/, "")}` : null,
  audio_url: tracks[0]?.audio_file_path ? `/${tracks[0].audio_file_path.replace(/^\/+/, "")}` : null,
  tracks: tracks.map((track) => ({
    ...track,
    song_name: track.song_name || track.title,
    track_url: `/track/${slugify(track.song_name || track.title || track.isrc || track.id)}`,
    audio_url: track.audio_file_path ? `/${track.audio_file_path.replace(/^\/+/, "")}` : null,
  })),
});

const getReleasePlatformLinks = async (releaseId) => {
  const result = await pool.query(
    `
    SELECT tpl.*, COALESCE(t.title, t.song_name) AS track_title, t.isrc
    FROM track_platform_links tpl
    LEFT JOIN tracks t ON t.id = tpl.track_id
    WHERE tpl.release_id = $1 OR t.release_id = $1
    ORDER BY tpl.platform ASC
    `,
    [releaseId]
  );

  return result.rows;
};

const getReleaseFiles = async (releaseId, client = pool) => {
  const result = await client.query(
    `
    SELECT *
    FROM release_files
    WHERE release_id = $1
    ORDER BY created_at DESC, id DESC
    `,
    [releaseId]
  );

  return result.rows;
};

const getLegacyUserId = (user) => (isIntegerId(user?.id) ? Number(user.id) : null);

const isIntegerId = (value) => /^\d+$/.test(String(value || ""));

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);

module.exports = {
  getReleaseById,
  getTracksByReleaseId,
  getReleaseScope,
  canReadRelease,
  canEditRelease,
  canEditMetadata,
  formatReleaseResponse,
  getReleasePlatformLinks,
  getReleaseFiles,
  getLegacyUserId,
  isIntegerId,
  isUuid
};
