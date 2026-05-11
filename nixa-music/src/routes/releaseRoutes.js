const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const pool = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { ensureReleaseSchema } = require("../services/releaseSchema");
const {
  buildQcReport,
  calculateReleaseCompletion,
  calculateTrackCompletion,
  generateIsrc,
  normalizeMetadataStatus,
  phase9Statuses,
  slugify,
  toArray,
} = require("../services/catalog/catalogEngine");
const {
  buildTemplateRows,
  defaultMetadataFormats,
  detectMetadataFormat,
  mapMetadataRow,
  parseDateValue,
  validateMetadataRow,
} = require("../services/catalog/metadataFormats");
const { knownPlatforms, runAdvancedQc } = require("../services/catalog/qcEngine");
const { createNotification } = require("../services/notifications/notificationService");
const { getCatalogDailyPerformance } = require("../services/daily/dailyService");

const router = express.Router();

const uploadRoot = path.resolve(process.cwd(), "uploads", "releases");
const artworkDir = path.join(uploadRoot, "artwork");
const audioDir = path.join(uploadRoot, "audio");
const allowedStatuses = phase9Statuses;
const allowedReleaseTypes = ["single", "ep", "album"];
const allowedDeliveryStatuses = [
  "pending",
  "queued",
  "delivering",
  "processing",
  "delivered",
  "live",
  "rejected",
  "failed",
  "updated",
  "takedown",
  "takedown_requested",
  "removed",
  "retry_pending",
  "retrying",
  "retry_failed",
  "retry_success",
  "cancelled",
];
const allowedTakedownStatuses = ["requested", "processing", "completed", "rejected"];
const artworkTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const audioTypes = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"]);

fs.mkdirSync(artworkDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

const normalizeStoredPath = (filePath) => path.relative(process.cwd(), filePath).replace(/\\/g, "/");

const normalizeText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const normalizeBoolean = (value) => value === true || value === "true" || value === "1" || value === "on";

const normalizeStatus = (status, fallback = "submitted") => {
  return normalizeMetadataStatus(status, fallback);
};

const normalizeReleaseType = (type) => {
  const normalized = normalizeText(type)?.toLowerCase() || "single";
  return allowedReleaseTypes.includes(normalized) ? normalized : "single";
};

const normalizeDeliveryStatus = (status, fallback = "pending") => {
  const normalized = normalizeText(status)?.toLowerCase() || fallback;
  return allowedDeliveryStatuses.includes(normalized) ? normalized : fallback;
};

const isIntegerId = (value) => /^\d+$/.test(String(value || ""));

const getLegacyUserId = (user) => (isIntegerId(user?.id) ? Number(user.id) : null);

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);

const getTrackOwnerType = (user) => (user?.role === "label" ? "label" : "artist");

const getPublicFileUrl = (releaseId, type) => `/api/releases/download/${type}/${releaseId}`;

const getStaticFileUrl = (storedPath) => (storedPath ? `/${storedPath.replace(/^\/+/, "")}` : null);

const addUserOwnershipCheck = (checks, values, user) => {
  if (!user?.id) {
    return;
  }

  values.push(String(user.id));
  const index = values.length;
  checks.push(`
    (
      r.created_by = $${index}
      OR EXISTS (
        SELECT 1
        FROM audit_logs al
        WHERE al.entity_type = 'release'
          AND al.entity_id = r.id
          AND al.user_id::text = $${index}
          AND al.action IN ('release.create', 'release.update')
      )
    )
  `);
};

const getSafeFilePath = (storedPath) => {
  if (!storedPath) {
    return null;
  }

  const resolvedPath = path.resolve(process.cwd(), storedPath);
  const safeUploadRoot = path.resolve(process.cwd(), "uploads");

  if (!resolvedPath.startsWith(safeUploadRoot)) {
    return null;
  }

  return resolvedPath;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.fieldname === "artwork" ? artworkDir : audioDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    cb(null, `${Date.now()}-${base || file.fieldname}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === "artwork") {
    const valid = artworkTypes.has(file.mimetype) && [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    return cb(valid ? null : new Error("Artwork must be JPG, PNG, or WebP."), valid);
  }

  if (file.fieldname === "audio") {
    const valid = audioTypes.has(file.mimetype) && [".mp3", ".wav"].includes(ext);
    return cb(valid ? null : new Error("Audio must be MP3 or WAV."), valid);
  }

  return cb(new Error(`Unsupported upload field: ${file.fieldname}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 51,
    fileSize: 100 * 1024 * 1024,
  },
}).fields([
  { name: "artwork", maxCount: 1 },
  { name: "audio", maxCount: 50 },
]);

const runUpload = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) {
      return next();
    }

    const message =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Files must be smaller than 100 MB."
        : error.message;

    return res.status(400).json({ message });
  });
};

const metadataUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 20 * 1024 * 1024,
  },
});

const getReleaseScope = async (user) => {
  if (["admin", "accountant"].includes(user.role)) {
    return { clause: "", values: [] };
  }

  if (user.role === "artist") {
    const values = [];
    const checks = [];

    addUserOwnershipCheck(checks, values, user);

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

  addUserOwnershipCheck(checks, values, user);

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

const buildListWhere = async (req) => {
  const scope = await getReleaseScope(req.user);
  const values = [...scope.values];
  const conditions = [];

  if (scope.clause) {
    conditions.push(scope.clause);
  }

  if (req.query.search) {
    values.push(`%${req.query.search.trim()}%`);
    const index = values.length;
    conditions.push(`
      (
        r.title ILIKE $${index}
        OR r.release_title ILIKE $${index}
        OR r.primary_artist ILIKE $${index}
        OR r.label_name ILIKE $${index}
        OR r.upc ILIKE $${index}
        OR EXISTS (
          SELECT 1 FROM tracks t
          WHERE t.release_id = r.id
            AND (t.isrc ILIKE $${index} OR t.title ILIKE $${index} OR t.song_name ILIKE $${index})
        )
      )
    `);
  }

  if (req.query.status) {
    values.push(req.query.status.toLowerCase());
    conditions.push(`r.status = $${values.length}`);
  }

  if (req.query.releaseType) {
    values.push(req.query.releaseType.toLowerCase());
    conditions.push(`r.release_type = $${values.length}`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

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

  if (release.status === "draft") {
    return canReadRelease(user, release);
  }

  if (release.status !== "updated") {
    return false;
  }

  if (getLegacyUserId(user) && Number(release.user_id) === getLegacyUserId(user)) {
    return true;
  }

  return canReadRelease(user, release);
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

const insertReleaseFiles = async (client, releaseId, files) => {
  const inserted = { audioFiles: [] };

  const artwork = files?.artwork?.[0];

  if (artwork) {
    if (artwork.size > 15 * 1024 * 1024) {
      throw new Error("Artwork must be smaller than 15 MB.");
    }

    const storedPath = normalizeStoredPath(artwork.path);
    await client.query(
      `
      INSERT INTO release_files (release_id, file_type, file_name, file_path, mime_type, size)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [releaseId, "artwork", artwork.originalname, storedPath, artwork.mimetype, artwork.size]
    );

    inserted.artwork = storedPath;
  }

  for (const file of files?.audio || []) {
    const storedPath = normalizeStoredPath(file.path);
    await client.query(
      `
      INSERT INTO release_files (release_id, file_type, file_name, file_path, mime_type, size)
      VALUES ($1, 'audio', $2, $3, $4, $5)
      `,
      [releaseId, file.originalname, storedPath, file.mimetype, file.size]
    );

    inserted.audioFiles.push(storedPath);
  }

  inserted.audio = inserted.audioFiles[0] || null;

  return inserted;
};

const mapReleasePayload = (body) => ({
  release_type: normalizeReleaseType(body.release_type),
  title: normalizeText(body.release_title || body.title),
  release_title: normalizeText(body.release_title || body.title),
  permalink_slug: normalizeText(body.permalink_slug),
  primary_artist: normalizeText(body.primary_artist),
  featured_artists: normalizeText(body.featured_artists),
  label_name: normalizeText(body.label_name),
  sub_label_name: normalizeText(body.sub_label_name),
  genre: normalizeText(body.genre),
  sub_genre: normalizeText(body.sub_genre),
  language: normalizeText(body.language),
  original_release_date: normalizeText(body.original_release_date),
  release_date: normalizeText(body.release_date),
  go_live_date: normalizeText(body.go_live_date),
  upc: normalizeText(body.upc),
  copyright_owner: normalizeText(body.copyright_owner || body.copyright_holder),
  copyright_holder: normalizeText(body.copyright_holder || body.copyright_owner),
  copyright_line: normalizeText(body.copyright_line),
  production_year: Number.parseInt(body.production_year, 10) || null,
  catalog_number: normalizeText(body.catalog_number),
  publisher: normalizeText(body.publisher),
  explicit: normalizeBoolean(body.explicit),
  notes: normalizeText(body.notes),
  internal_notes: normalizeText(body.internal_notes),
  territory_mode: normalizeText(body.territory_mode) || "worldwide",
  included_territories: toArray(body.included_territories),
  excluded_territories: toArray(body.excluded_territories),
  store_selection: toArray(body.store_selection),
  distribution_type: normalizeText(body.distribution_type) || "standard",
  promotional_release: normalizeBoolean(body.promotional_release),
  status: normalizeStatus(body.status),
  current_owner: normalizeText(body.current_owner),
  previous_owner: normalizeText(body.previous_owner),
  ownership_transferable: body.ownership_transferable === undefined ? true : normalizeBoolean(body.ownership_transferable),
  artist_id: isUuid(body.artist_id) ? body.artist_id : null,
  label_id: isIntegerId(body.label_id) ? Number(body.label_id) : null,
});

const mapTrackPayload = (body) => ({
  id: isUuid(body.id) ? body.id : null,
  title: normalizeText(body.song_name || body.track_title || body.title),
  song_name: normalizeText(body.song_name || body.track_title || body.title),
  primary_artist: normalizeText(body.primary_artist),
  featuring_artist: normalizeText(body.featuring_artist || body.featured_artists),
  remixer: normalizeText(body.remixer),
  isrc: normalizeText(body.isrc),
  iswc: normalizeText(body.iswc),
  composer: normalizeText(body.composer),
  lyricist: normalizeText(body.lyricist),
  producer: normalizeText(body.producer),
  director: normalizeText(body.director),
  star_cast: normalizeText(body.star_cast),
  description: normalizeText(body.description),
  duration: normalizeText(body.duration),
  version: normalizeText(body.version),
  language: normalizeText(body.track_language || body.language),
  genre: normalizeText(body.genre),
  subgenre: normalizeText(body.subgenre || body.sub_genre),
  mood: normalizeText(body.mood),
  explicit: normalizeBoolean(body.track_explicit ?? body.explicit),
  instrumental: normalizeBoolean(body.instrumental),
  preview_start_time: normalizeText(body.preview_start_time),
  tiktok_clip_start: normalizeText(body.tiktok_clip_start),
  crbt_title: normalizeText(body.crbt_title),
  crbt_start_time_1: normalizeText(body.crbt_start_time_1),
  crbt_start_time_2: normalizeText(body.crbt_start_time_2),
  dolby_atmos: normalizeBoolean(body.dolby_atmos),
  lyrics_file: normalizeText(body.lyrics_file),
  bitrate: Number.parseInt(body.bitrate, 10) || null,
  sample_rate: Number.parseInt(body.sample_rate, 10) || null,
  stereo_mono: normalizeText(body.stereo_mono),
});

const parseJsonArray = (value) => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const mapTrackPayloads = (body) => {
  const parsedTracks = parseJsonArray(body.tracks);

  if (parsedTracks?.length) {
    return parsedTracks.map((track) => mapTrackPayload(track));
  }

  return [mapTrackPayload(body)];
};

const validateReleasePayload = (release, tracks) => {
  const errors = [];
  const releaseTracks = Array.isArray(tracks) ? tracks : [tracks];
  const isDraft = release.status === "draft";

  if (release.release_type === "single" && releaseTracks.length > 1) {
    errors.push("Single releases can only contain one track.");
  }

  if (isDraft) {
    const draftIsrcs = releaseTracks.map((track) => track.isrc?.toUpperCase()).filter(Boolean);
    if (new Set(draftIsrcs).size !== draftIsrcs.length) {
      errors.push("Draft contains duplicate ISRC values.");
    }
    return errors;
  }

  if (!release.title) errors.push("Release title is required.");
  if (!release.primary_artist) errors.push("Primary artist is required.");
  if (!release.label_name) errors.push("Label is required.");
  if (!release.genre) errors.push("Genre is required.");
  if (!release.language) errors.push("Release language is required.");
  if (!release.release_date) errors.push("Release date is required.");
  if (!releaseTracks.length) errors.push("At least one track is required.");

  const seenIsrcs = new Set();
  releaseTracks.forEach((track, index) => {
    const trackNumber = index + 1;

    if (!track.title) errors.push(`Track ${trackNumber} title is required.`);
    if (track.isrc) {
      const normalizedIsrc = track.isrc.toUpperCase();
      if (seenIsrcs.has(normalizedIsrc)) {
        errors.push(`Track ${trackNumber} has a duplicate ISRC.`);
      }
      seenIsrcs.add(normalizedIsrc);
    }
  });

  return errors;
};

const findDuplicateCatalogCodes = async (client, { releaseId = null, upc = null, isrcs = [] }) => {
  const duplicateIsrcs = [];
  let duplicateUpc = false;

  if (upc) {
    const values = [upc];
    let clause = "UPPER(upc) = UPPER($1)";
    if (releaseId) {
      values.push(releaseId);
      clause += ` AND id <> $${values.length}`;
    }

    const result = await client.query(`SELECT 1 FROM releases WHERE ${clause} LIMIT 1`, values);
    duplicateUpc = result.rows.length > 0;
  }

  const uniqueIsrcs = [...new Set(isrcs.filter(Boolean).map((isrc) => String(isrc).trim().toUpperCase()))];
  if (uniqueIsrcs.length) {
    const values = [uniqueIsrcs];
    let clause = "UPPER(isrc) = ANY($1::text[])";
    if (releaseId) {
      values.push(releaseId);
      clause += ` AND release_id <> $${values.length}`;
    }

    const result = await client.query(`SELECT DISTINCT UPPER(isrc) AS isrc FROM tracks WHERE ${clause}`, values);
    duplicateIsrcs.push(...result.rows.map((row) => row.isrc));
  }

  return { duplicateIsrcs, duplicateUpc };
};

const prepareCatalogPayload = async (client, release, tracks, { user, releaseId = null } = {}) => {
  const nextRelease = {
    ...release,
    release_title: release.release_title || release.title,
    title: release.title || release.release_title,
    permalink_slug: release.permalink_slug || slugify(release.release_title || release.title),
    copyright_holder: release.copyright_holder || release.copyright_owner,
    copyright_line: release.copyright_line || release.copyright_holder || release.copyright_owner,
    production_year:
      release.production_year ||
      Number.parseInt(String(release.release_date || release.original_release_date || new Date().getFullYear()).slice(0, 4), 10) ||
      null,
    current_owner: release.current_owner || String(user?.id || ""),
  };

  const nextTracks = [];
  for (const track of tracks) {
    const nextTrack = {
      ...track,
      title: track.title || track.song_name,
      song_name: track.song_name || track.title,
      primary_artist: track.primary_artist || nextRelease.primary_artist,
      genre: track.genre || nextRelease.genre,
      language: track.language || nextRelease.language,
    };

    if (!nextTrack.isrc && nextRelease.status !== "draft") {
      nextTrack.isrc = await generateIsrc(client);
    }

    nextTrack.metadata_completion_percentage = calculateTrackCompletion(nextTrack);
    nextTracks.push(nextTrack);
  }

  const duplicates = await findDuplicateCatalogCodes(client, {
    releaseId,
    upc: nextRelease.upc,
    isrcs: nextTracks.map((track) => track.isrc),
  });
  const qcReport = buildQcReport({ release: nextRelease, tracks: nextTracks, ...duplicates });

  nextRelease.metadata_completion_percentage = qcReport.completion;
  nextRelease.qc_status = qcReport.status;
  nextRelease.qc_score = qcReport.score;
  nextRelease.qc_warnings = qcReport.warnings;
  nextRelease.qc_errors = qcReport.errors;

  return { release: nextRelease, tracks: nextTracks, qcReport };
};

const updateCatalogQuality = async (client, releaseId, release, tracks) => {
  const completion = calculateReleaseCompletion(release, tracks);
  const duplicates = await findDuplicateCatalogCodes(client, {
    releaseId,
    upc: release.upc,
    isrcs: tracks.map((track) => track.isrc),
  });
  const qcReport = buildQcReport({ release, tracks, ...duplicates });

  await client.query(
    `
    UPDATE releases
    SET metadata_completion_percentage = $1,
        qc_status = $2,
        qc_score = $3,
        qc_warnings = $4,
        qc_errors = $5,
        updated_at = NOW()
    WHERE id = $6
    `,
    [completion, qcReport.status, qcReport.score, JSON.stringify(qcReport.warnings), JSON.stringify(qcReport.errors), releaseId]
  );

  for (const track of tracks) {
    if (!track.id) continue;
    await client.query(
      `
      UPDATE tracks
      SET metadata_completion_percentage = $1,
          qc_status = $2,
          qc_score = $3,
          qc_warnings = $4,
          qc_errors = $5,
          updated_at = NOW()
      WHERE id = $6
      `,
      [
        calculateTrackCompletion(track),
        qcReport.errors.length ? "failed" : qcReport.warnings.length ? "warning" : "passed",
        qcReport.score,
        JSON.stringify(qcReport.warnings),
        JSON.stringify(qcReport.errors),
        track.id,
      ]
    );
  }

  return qcReport;
};

const formatReleaseResponse = (release, tracks = []) => ({
  ...release,
  release_title: release.release_title || release.title,
  permalink_slug: release.permalink_slug || slugify(release.release_title || release.title || release.id),
  release_url: `/release/${release.permalink_slug || slugify(release.release_title || release.title || release.id)}`,
  artwork_url: getStaticFileUrl(release.artwork_file_path),
  audio_url: getStaticFileUrl(tracks[0]?.audio_file_path),
  tracks: tracks.map((track) => ({
    ...track,
    song_name: track.song_name || track.title,
    track_url: `/track/${slugify(track.song_name || track.title || track.isrc || track.id)}`,
    audio_url: getStaticFileUrl(track.audio_file_path),
    audio_download_url: track.audio_file_path ? getPublicFileUrl(release.id, "audio") : null,
  })),
  artwork_download_url: release.artwork_file_path ? getPublicFileUrl(release.id, "artwork") : null,
  audio_download_url: tracks[0]?.audio_file_path ? getPublicFileUrl(release.id, "audio") : null,
});

const getReleaseDeliveries = async (releaseId) => {
  const result = await pool.query(
    `
    SELECT
      rd.*,
      COALESCE(t.title, t.song_name) AS track_title,
      t.isrc,
      dq.id AS queue_id,
      dq.delivery_status AS queue_status,
      dq.retry_count,
      dq.next_retry,
      dq.priority,
      dq.delivery_logs AS queue_logs
    FROM release_deliveries rd
    LEFT JOIN tracks t ON t.id = rd.track_id
    LEFT JOIN LATERAL (
      SELECT *
      FROM delivery_queue q
      WHERE q.release_id = rd.release_id
        AND COALESCE(q.track_id::text, '') = COALESCE(rd.track_id::text, '')
        AND LOWER(q.platform) = LOWER(rd.platform)
      ORDER BY q.updated_at DESC, q.created_at DESC
      LIMIT 1
    ) dq ON true
    WHERE rd.release_id = $1
    ORDER BY rd.platform ASC, rd.last_updated DESC
    `,
    [releaseId]
  );

  return result.rows;
};

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

const getReleaseOwnershipHistory = async (releaseId) => {
  const result = await pool.query(
    `
    SELECT *
    FROM ownership_transfer_logs
    WHERE release_id = $1
    ORDER BY created_at DESC
    `,
    [releaseId]
  );

  return result.rows;
};

const getReleaseAnalytics = async (releaseId) => {
  return getCatalogDailyPerformance({ releaseId });
};

const getReleaseRevenueHealth = async (releaseId) => {
  const result = await pool.query(
    `
    SELECT
      COALESCE(SUM(cr.gross_revenue), 0)::numeric AS gross_revenue,
      COALESCE(SUM(cr.net_revenue), 0)::numeric AS net_revenue,
      COALESCE(SUM(cr.payable_amount), 0)::numeric AS payable_amount,
      COALESCE(SUM(cr.paid_amount), 0)::numeric AS paid_amount,
      COALESCE(SUM(cr.pending_amount), 0)::numeric AS pending_amount
    FROM tracks t
    LEFT JOIN calculated_revenues cr ON cr.track_id = t.id
    WHERE t.release_id = $1
    `,
    [releaseId]
  );

  return result.rows[0] || {};
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

const getLatestQcReport = async (releaseId) => {
  const [releaseReport, trackReports, conflicts, locks] = await Promise.all([
    pool.query(
      `
      SELECT *
      FROM release_qc_reports
      WHERE release_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [releaseId]
    ),
    pool.query(
      `
      SELECT tqr.*, COALESCE(t.song_name, t.title) AS track_title, t.isrc
      FROM track_qc_reports tqr
      LEFT JOIN tracks t ON t.id = tqr.track_id
      WHERE tqr.release_id = $1
      ORDER BY tqr.created_at DESC
      `,
      [releaseId]
    ),
    pool.query(
      `
      SELECT *
      FROM conflict_reports
      WHERE release_id = $1 AND status = 'open'
      ORDER BY detected_at DESC
      `,
      [releaseId]
    ),
    pool.query(
      `
      SELECT *
      FROM metadata_lock_logs
      WHERE release_id = $1
      ORDER BY created_at DESC
      LIMIT 25
      `,
      [releaseId]
    ),
  ]);

  return {
    latest: releaseReport.rows[0] || null,
    tracks: trackReports.rows,
    conflicts: conflicts.rows,
    locks: locks.rows,
  };
};

const getDeliveryQueueRows = async (releaseId) => {
  const result = await pool.query(
    `
    SELECT dq.*, COALESCE(t.song_name, t.title) AS track_title, t.isrc
    FROM delivery_queue dq
    LEFT JOIN tracks t ON t.id = dq.track_id
    WHERE dq.release_id = $1
    ORDER BY dq.priority ASC, dq.created_at DESC
    `,
    [releaseId]
  );

  return result.rows;
};

const normalizeDeliveryPlatforms = (platforms, release, tracks) => {
  const requested = Array.isArray(platforms) ? platforms : toArray(platforms);
  const releaseStores = toArray(release?.store_selection);
  const trackStores = tracks.flatMap((track) => toArray(track.platforms));
  const next = (requested.length ? requested : [...releaseStores, ...trackStores])
    .map((platform) => normalizeText(platform))
    .filter(Boolean);

  return [...new Set(next.length ? next : knownPlatforms.slice(0, 6))];
};

const syncReleaseDeliveryStatus = async (client, releaseId) => {
  const statusResult = await client.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE delivery_status IN ('failed', 'rejected', 'retry_failed')) AS failed_count,
      COUNT(*) FILTER (WHERE delivery_status IN ('queued', 'retry_pending')) AS queued_count,
      COUNT(*) FILTER (WHERE delivery_status IN ('delivering', 'processing', 'retrying')) AS active_count,
      COUNT(*) FILTER (WHERE delivery_status = 'live') AS live_count,
      COUNT(*) FILTER (WHERE delivery_status IN ('delivered', 'live', 'updated', 'retry_success')) AS delivered_count,
      COUNT(*) AS total_count
    FROM release_deliveries
    WHERE release_id = $1
    `,
    [releaseId]
  );

  const summary = statusResult.rows[0] || {};
  const nextDeliveryStatus =
    Number(summary.failed_count) > 0
      ? "failed"
      : Number(summary.active_count) > 0
        ? "processing"
        : Number(summary.queued_count) > 0
          ? "queued"
          : Number(summary.live_count) > 0
            ? "live"
            : Number(summary.delivered_count) > 0
              ? "delivered"
              : "pending";

  await client.query("UPDATE releases SET delivery_status = $1, updated_at = NOW() WHERE id = $2", [
    nextDeliveryStatus,
    releaseId,
  ]);

  return nextDeliveryStatus;
};

const appendDeliveryLog = async (client, { queueId, releaseId, trackId = null, platform, action, oldStatus, newStatus, message, userId }) => {
  const log = {
    action,
    old_status: oldStatus || null,
    new_status: newStatus || null,
    message: message || null,
    performed_by: userId || null,
    created_at: new Date().toISOString(),
  };

  await client.query(
    `
    INSERT INTO delivery_logs (queue_id, release_id, track_id, platform, action, old_status, new_status, message, performed_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [queueId, releaseId, trackId, platform, action, oldStatus || null, newStatus || null, message || null, userId || null]
  );

  if (queueId) {
    await client.query(
      `
      UPDATE delivery_queue
      SET delivery_logs = COALESCE(delivery_logs, '[]'::jsonb) || $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
      `,
      [JSON.stringify([log]), queueId]
    );
  }
};

const queueReleaseDelivery = async (client, { release, tracks = [], platforms = [], priority = 5, userId, message = "Queued for DSP delivery." }) => {
  const targetPlatforms = normalizeDeliveryPlatforms(platforms, release, tracks);
  const queued = [];

  for (const platform of targetPlatforms) {
    const existingQueue = await client.query(
      `
      SELECT *
      FROM delivery_queue
      WHERE release_id = $1
        AND track_id IS NULL
        AND LOWER(platform) = LOWER($2)
        AND delivery_status NOT IN ('cancelled', 'removed', 'takedown_complete')
      LIMIT 1
      `,
      [release.id, platform]
    );

    let queueRow;
    if (existingQueue.rows[0]) {
      const result = await client.query(
        `
        UPDATE delivery_queue
        SET priority = $1,
            delivery_status = CASE
              WHEN delivery_status IN ('failed', 'rejected', 'retry_failed') THEN 'retry_pending'
              ELSE 'queued'
            END,
            next_retry = NULL,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [priority, existingQueue.rows[0].id]
      );
      queueRow = result.rows[0];
    } else {
      const result = await client.query(
        `
        INSERT INTO delivery_queue (release_id, track_id, platform, priority, delivery_status, created_by)
        VALUES ($1, NULL, $2, $3, 'queued', $4)
        RETURNING *
        `,
        [release.id, platform, priority, userId]
      );
      queueRow = result.rows[0];
    }

    const existingDelivery = await client.query(
      `
      SELECT *
      FROM release_deliveries
      WHERE release_id = $1 AND track_id IS NULL AND LOWER(platform) = LOWER($2)
      ORDER BY last_updated DESC
      LIMIT 1
      `,
      [release.id, platform]
    );

    if (existingDelivery.rows[0]) {
      await client.query(
        `
        UPDATE release_deliveries
        SET delivery_status = 'queued',
            last_updated = NOW(),
            delivery_notes = $1,
            updated_by = $2
        WHERE id = $3
        `,
        [message, userId, existingDelivery.rows[0].id]
      );
    } else {
      await client.query(
        `
        INSERT INTO release_deliveries (release_id, track_id, platform, delivery_status, last_updated, delivery_notes, updated_by)
        VALUES ($1, NULL, $2, 'queued', NOW(), $3, $4)
        `,
        [release.id, platform, message, userId]
      );
    }

    await appendDeliveryLog(client, {
      queueId: queueRow.id,
      releaseId: release.id,
      platform,
      action: "queue",
      oldStatus: existingQueue.rows[0]?.delivery_status,
      newStatus: queueRow.delivery_status,
      message,
      userId,
    });

    queued.push(queueRow);
  }

  const nextDeliveryStatus = await syncReleaseDeliveryStatus(client, release.id);
  await client.query(
    `
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES ($1, 'release.delivery_queue', 'release', $2, $3)
    `,
    [userId, release.id, JSON.stringify({ platforms: targetPlatforms, delivery_status: nextDeliveryStatus })]
  );

  return { queued, delivery_status: nextDeliveryStatus, platforms: targetPlatforms };
};

const persistAdvancedQcReport = async (client, { release, tracks, deliveries, files, userId }) => {
  const qc = await runAdvancedQc({ client, release, tracks, deliveries, files });

  const releaseReport = await client.query(
    `
    INSERT INTO release_qc_reports (
      release_id, qc_score, metadata_completion, release_health, status, categories,
      warnings, errors, suggestions, conflicts, run_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
    `,
    [
      release.id,
      qc.qcScore,
      qc.metadataCompletion,
      qc.releaseHealth,
      qc.status,
      JSON.stringify(qc.categories),
      JSON.stringify(qc.warnings),
      JSON.stringify(qc.errors),
      JSON.stringify(qc.suggestions),
      JSON.stringify(qc.conflicts),
      userId,
    ]
  );

  await client.query(
    `
    UPDATE releases
    SET metadata_completion_percentage = $1,
        qc_status = $2,
        qc_score = $3,
        qc_warnings = $4,
        qc_errors = $5,
        release_health_score = $6,
        updated_at = NOW()
    WHERE id = $7
    `,
    [
      qc.metadataCompletion,
      qc.status,
      qc.qcScore,
      JSON.stringify(qc.warnings),
      JSON.stringify(qc.errors),
      qc.releaseHealth,
      release.id,
    ]
  );

  await client.query(
    `
    INSERT INTO release_health_reports (release_id, health_score, factors, suggestions, created_by)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [
      release.id,
      qc.releaseHealth,
      JSON.stringify({
        qc_score: qc.qcScore,
        metadata_completion: qc.metadataCompletion,
        category_scores: Object.fromEntries(Object.entries(qc.categories).map(([key, value]) => [key, value.score])),
      }),
      JSON.stringify(qc.suggestions),
      userId,
    ]
  );

  await client.query(
    `
    UPDATE conflict_reports
    SET status = 'superseded', resolved_at = NOW(), resolved_by = $2
    WHERE release_id = $1 AND status = 'open'
    `,
    [release.id, userId]
  );

  for (const conflict of qc.conflicts) {
    await client.query(
      `
      INSERT INTO conflict_reports (release_id, track_id, conflict_type, severity, status, message, details)
      VALUES ($1, $2, $3, $4, 'open', $5, $6)
      `,
      [
        release.id,
        conflict.track_id || null,
        conflict.conflict_type,
        conflict.severity || "warning",
        conflict.message,
        JSON.stringify(conflict.details || {}),
      ]
    );
  }

  for (const report of qc.trackReports) {
    await client.query(
      `
      INSERT INTO track_qc_reports (
        release_id, track_id, qc_score, metadata_completion, status, categories,
        warnings, errors, suggestions, run_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        release.id,
        report.track_id,
        report.qcScore,
        report.metadataCompletion,
        report.status,
        JSON.stringify(report.categories),
        JSON.stringify(report.warnings),
        JSON.stringify(report.errors),
        JSON.stringify(report.suggestions),
        userId,
      ]
    );

    if (report.track_id) {
      await client.query(
        `
        UPDATE tracks
        SET metadata_completion_percentage = $1,
            qc_status = $2,
            qc_score = $3,
            qc_warnings = $4,
            qc_errors = $5,
            updated_at = NOW()
        WHERE id = $6
        `,
        [
          report.metadataCompletion,
          report.status,
          report.qcScore,
          JSON.stringify(report.warnings),
          JSON.stringify(report.errors),
          report.track_id,
        ]
      );
    }
  }

  await client.query(
    `
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES ($1, 'release.qc_run', 'release', $2, $3)
    `,
    [userId, release.id, JSON.stringify({ status: qc.status, score: qc.qcScore, health: qc.releaseHealth })]
  );

  return { ...qc, report: releaseReport.rows[0] };
};

const loadReleaseQcInputs = async (client, releaseId) => {
  const release = await getReleaseById(releaseId);
  if (!release) {
    return null;
  }

  const [tracks, deliveries, files] = await Promise.all([
    getTracksByReleaseId(release.id),
    client.query("SELECT * FROM release_deliveries WHERE release_id = $1 ORDER BY platform ASC", [release.id]).then((result) => result.rows),
    getReleaseFiles(release.id, client),
  ]);

  return { release, tracks, deliveries, files };
};

const getMetadataExportRows = async (type = "full") => {
  const result = await pool.query(
    `
    SELECT
      r.id AS release_id,
      r.release_type,
      COALESCE(r.release_title, r.title) AS release_title,
      r.permalink_slug,
      r.upc,
      r.original_release_date,
      r.release_date,
      r.go_live_date,
      r.label_name,
      r.sub_label_name,
      r.copyright_holder,
      r.copyright_line,
      r.copyright_owner,
      r.production_year,
      r.catalog_number,
      r.territory_mode,
      r.included_territories,
      r.excluded_territories,
      r.store_selection,
      r.distribution_type,
      r.promotional_release,
      r.status,
      r.qc_status,
      r.qc_score,
      r.metadata_completion_percentage,
      r.delivery_status,
      r.current_owner,
      r.previous_owner,
      r.created_at AS release_created_at,
      r.updated_at AS release_updated_at,
      t.id AS track_id,
      COALESCE(t.song_name, t.title) AS song_name,
      t.version,
      t.primary_artist AS track_primary_artist,
      t.featuring_artist,
      t.remixer,
      t.composer,
      t.lyricist,
      t.producer,
      t.director,
      t.star_cast,
      t.description,
      t.genre AS track_genre,
      t.subgenre,
      t.mood,
      t.language AS track_language,
      t.explicit AS track_explicit,
      t.instrumental,
      t.preview_start_time,
      t.tiktok_clip_start,
      t.crbt_title,
      t.crbt_start_time_1,
      t.crbt_start_time_2,
      t.duration,
      t.isrc,
      t.iswc,
      t.dolby_atmos,
      t.bitrate,
      t.sample_rate,
      t.stereo_mono,
      t.metadata_completion_percentage AS track_completion,
      t.qc_status AS track_qc_status,
      rd.platform AS delivery_platform,
      rd.platform_track_id,
      rd.platform_url AS delivery_url,
      rd.delivery_status AS platform_delivery_status,
      rd.delivery_date,
      tpl.platform AS link_platform,
      tpl.platform_url AS link_url
    FROM releases r
    LEFT JOIN tracks t ON t.release_id = r.id
    LEFT JOIN release_deliveries rd ON rd.release_id = r.id AND (rd.track_id = t.id OR rd.track_id IS NULL)
    LEFT JOIN track_platform_links tpl ON tpl.track_id = t.id
    ORDER BY r.created_at DESC, t.created_at ASC, rd.platform ASC, tpl.platform ASC
    `
  );

  const normalizedType = String(type || "full").toLowerCase();
  return result.rows.map((row) => {
    if (normalizedType === "dsp_links") {
      return {
        UPC: row.upc,
        ISRC: row.isrc,
        "Release Title": row.release_title,
        "Track Title": row.song_name,
        Platform: row.link_platform || row.delivery_platform,
        URL: row.link_url || row.delivery_url,
        "Platform Track ID": row.platform_track_id,
        "Delivery Status": row.platform_delivery_status,
      };
    }

    if (normalizedType === "status") {
      return {
        "Release ID": row.release_id,
        UPC: row.upc,
        "Release Title": row.release_title,
        Status: row.status,
        "QC Status": row.qc_status,
        "QC Score": row.qc_score,
        "Metadata Completion": row.metadata_completion_percentage,
        "Delivery Status": row.delivery_status,
        "Current Owner": row.current_owner,
        "Updated At": row.release_updated_at,
      };
    }

    const base = {
      "Release ID": row.release_id,
      "Release Type": row.release_type,
      "Release Title": row.release_title,
      Slug: row.permalink_slug,
      UPC: row.upc,
      "Original Release Date": row.original_release_date,
      "Release Date": row.release_date,
      "Go Live Date": row.go_live_date,
      Label: row.label_name,
      "Sub Label": row.sub_label_name,
      "Copyright Holder": row.copyright_holder || row.copyright_owner,
      "Copyright Line": row.copyright_line,
      "Production Year": row.production_year,
      "Catalog Number": row.catalog_number,
      "Territory Mode": row.territory_mode,
      "Included Territories": Array.isArray(row.included_territories) ? row.included_territories.join(", ") : "",
      "Excluded Territories": Array.isArray(row.excluded_territories) ? row.excluded_territories.join(", ") : "",
      Stores: Array.isArray(row.store_selection) ? row.store_selection.join(", ") : "",
      "Distribution Type": row.distribution_type,
      Promotional: row.promotional_release ? "Yes" : "No",
      Status: row.status,
      "QC Status": row.qc_status,
      "Metadata Completion": row.metadata_completion_percentage,
      "Track ID": row.track_id,
      "Song Name": row.song_name,
      Version: row.version,
      "Track Primary Artist": row.track_primary_artist,
      Featuring: row.featuring_artist,
      Remixer: row.remixer,
      Composer: row.composer,
      Lyricist: row.lyricist,
      Producer: row.producer,
      Genre: row.track_genre,
      Subgenre: row.subgenre,
      Mood: row.mood,
      Language: row.track_language,
      Explicit: row.track_explicit ? "Yes" : "No",
      Instrumental: row.instrumental ? "Yes" : "No",
      Duration: row.duration,
      ISRC: row.isrc,
      ISWC: row.iswc,
      "Dolby Atmos": row.dolby_atmos ? "Yes" : "No",
      "Track Completion": row.track_completion,
      "Track QC": row.track_qc_status,
    };

    if (normalizedType === "v1") {
      return base;
    }

    return {
      ...base,
      Director: row.director,
      "Star Cast": row.star_cast,
      Description: row.description,
      "Preview Start": row.preview_start_time,
      "TikTok Clip Start": row.tiktok_clip_start,
      "CRBT Title": row.crbt_title,
      "CRBT Start 1": row.crbt_start_time_1,
      "CRBT Start 2": row.crbt_start_time_2,
      Bitrate: row.bitrate,
      "Sample Rate": row.sample_rate,
      "Stereo/Mono": row.stereo_mono,
      "Delivery Platform": row.delivery_platform,
      "Platform Track ID": row.platform_track_id,
      "Platform URL": row.delivery_url || row.link_url,
      "Platform Delivery Status": row.platform_delivery_status,
      "Delivery Date": row.delivery_date,
      "Current Owner": row.current_owner,
      "Previous Owner": row.previous_owner,
      "Created At": row.release_created_at,
      "Updated At": row.release_updated_at,
    };
  });
};

const parseMetadataWorkbook = (buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const allRows = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    rows.forEach((row) => {
      const values = Object.values(row || {}).map((value) => String(value || "").trim());
      if (values.some(Boolean)) {
        allRows.push({ ...row, __sheet_name: sheetName });
      }
    });
    if (allRows.length) {
      break;
    }
  }

  return allRows;
};

const getMetadataFormatSettings = async () => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'metadata_formats' LIMIT 1");
    return result.rows[0]?.value || defaultMetadataFormats;
  } catch {
    return defaultMetadataFormats;
  }
};

const normalizeRowValue = (row, names) => {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "") {
      return String(row[name]).trim();
    }
  }
  return null;
};

const normalizeRowDate = (row, names) => {
  for (const name of names) {
    const value = row[name];
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
      return String(value).trim();
    }
  }
  return null;
};

const normalizeRowInteger = (row, names) => {
  const value = normalizeRowValue(row, names);
  const parsed = Number.parseInt(String(value || "0").replace(/,/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeRowNumber = (row, names) => {
  const value = normalizeRowValue(row, names);
  const parsed = Number.parseFloat(String(value || "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const inferPlatformFromFilename = (fileName = "") => {
  const text = fileName.toLowerCase();
  if (text.includes("spotify")) return "Spotify";
  if (text.includes("apple")) return "Apple Music";
  if (text.includes("youtube")) return "YouTube Music";
  if (text.includes("jiosaavn") || text.includes("saavn")) return "JioSaavn";
  if (text.includes("wynk")) return "Wynk";
  if (text.includes("gaana")) return "Gaana";
  if (text.includes("amazon")) return "Amazon Music";
  return "Unknown";
};

const expandDailyPlayRows = (rows, fileName) => {
  const records = [];
  const inferredPlatform = inferPlatformFromFilename(fileName);
  const fixedHeaders = new Set([
    "isrc",
    "song name",
    "track",
    "album name",
    "release",
    "upc",
    "language",
    "genre",
    "year of release",
    "platform",
    "country",
    "city",
    "streams",
    "plays",
    "revenue",
    "currency",
    "listeners",
    "date",
    "report date",
  ]);

  rows.forEach((row, rowIndex) => {
    const simpleDate = normalizeRowDate(row, ["Report Date", "Date", "report_date", "date"]);
    if (simpleDate) {
      records.push({
        row_number: rowIndex + 2,
        isrc: normalizeRowValue(row, ["ISRC", "isrc"]),
        upc: normalizeRowValue(row, ["UPC", "upc"]),
        track_title: normalizeRowValue(row, ["Track", "Song Name", "song_name"]),
        release_title: normalizeRowValue(row, ["Release", "Album Name", "album_name"]),
        report_date: simpleDate,
        platform: normalizeRowValue(row, ["Platform", "platform"]) || inferredPlatform,
        country: normalizeRowValue(row, ["Country", "country"]) || "Unknown",
        city: normalizeRowValue(row, ["City", "city"]) || "Unknown",
        streams: normalizeRowInteger(row, ["Streams", "streams", "Plays", "plays"]),
        listeners: normalizeRowInteger(row, ["Listeners", "listeners"]),
        revenue: normalizeRowNumber(row, ["Revenue", "revenue"]),
        currency: normalizeRowValue(row, ["Currency", "currency"]) || "INR",
        raw_data: row,
      });
      return;
    }

    Object.entries(row || {}).forEach(([header, value]) => {
      const normalizedHeader = String(header || "").trim().toLowerCase();
      if (!header || fixedHeaders.has(normalizedHeader) || header === "__sheet_name") {
        return;
      }

      const date = parseDateValue(header);
      const streams = Number.parseInt(String(value || "0").replace(/,/g, ""), 10);
      if (!date || Number.isNaN(new Date(date).getTime()) || !Number.isFinite(streams)) {
        return;
      }

      records.push({
        row_number: rowIndex + 2,
        isrc: normalizeRowValue(row, ["ISRC", "isrc"]),
        upc: normalizeRowValue(row, ["UPC", "upc"]),
        track_title: normalizeRowValue(row, ["Track", "Song Name", "song_name"]),
        release_title: normalizeRowValue(row, ["Release", "Album Name", "album_name"]),
        report_date: date,
        platform: normalizeRowValue(row, ["Platform", "platform"]) || inferredPlatform,
        country: normalizeRowValue(row, ["Country", "country"]) || "Unknown",
        city: normalizeRowValue(row, ["City", "city"]) || "Unknown",
        streams: streams > 0 ? streams : 0,
        listeners: 0,
        revenue: 0,
        currency: "INR",
        raw_data: row,
      });
    });
  });

  return records;
};

const platformHeaderMap = {
  applemusic: "Apple Music",
  apple: "Apple Music",
  itunes: "Apple Music",
  jiosaan: "JioSaavn",
  jiosaavn: "JioSaavn",
  wynk: "Wynk",
  amazon: "Amazon Music",
  "amazon in": "Amazon Music",
  spotify: "Spotify",
  gaana: "Gaana",
  youtube: "YouTube Music",
  youtubecms: "YouTube CMS",
  "youtube music": "YouTube Music",
  facebook: "Facebook",
  "facebook_aap ww": "Facebook AAP",
  "facebook_srp ww": "Facebook SRP",
  "instagram/facebook": "Instagram/Facebook",
  tiktok: "TikTok",
  "tiktok bytedance": "TikTok",
  boomplay: "Boomplay",
  deezer: "Deezer",
  tidal: "Tidal",
  pandora: "Pandora",
  soundcloud: "SoundCloud",
  hungama: "Hungama",
};

const metadataStatusHeaders = new Set([
  "upc",
  "catalog number",
  "album",
  "song",
  "song_name",
  "album_name",
  "isrc",
  "label",
  "label id",
  "sub label",
  "sub label id",
  "brand name",
  "date of release",
  "go live date",
  "artistname",
  "composer",
  "lyricist",
  "language",
  "genre",
  "description",
  "mood",
  "sub category",
  "duration",
  "parental advisory",
  "dolby",
  "dolby isrc",
  "l1_name",
  "l2_name",
]);

const normalizePlatformName = (header) => {
  const key = String(header || "").trim().toLowerCase().replace(/\s+/g, " ");
  return platformHeaderMap[key] || (metadataStatusHeaders.has(key) || key.startsWith("__") ? null : String(header || "").trim());
};

const normalizePlatformStatus = (value) => {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text === "-") return null;
  if (text.includes("reject")) return "rejected";
  if (text.includes("live")) return "live";
  if (text.includes("released") || text.includes("delivered")) return "delivered";
  if (text.includes("update")) return "updated";
  if (text.includes("process") || text.includes("initiated")) return "processing";
  if (text.includes("remove")) return "removed";
  if (text.includes("takedown")) return "takedown_requested";
  return normalizeDeliveryStatus(text.replace(/\s+/g, "_"), "pending");
};

const getTrackByCatalogCodes = async (client, row) => {
  const isrc = normalizeRowValue(row, ["ISRC", "isrc"]);
  const upc = normalizeRowValue(row, ["UPC", "upc"]);
  const trackTitle = normalizeRowValue(row, ["Song", "Song Name", "song_name", "Track"]);

  const result = await client.query(
    `
    SELECT t.id, t.release_id, t.isrc, COALESCE(t.song_name, t.title) AS track_title
    FROM tracks t
    LEFT JOIN releases r ON r.id = t.release_id
    WHERE ($1::text IS NOT NULL AND UPPER(t.isrc) = UPPER($1))
       OR ($2::text IS NOT NULL AND UPPER(r.upc) = UPPER($2) AND ($3::text IS NULL OR COALESCE(t.song_name, t.title) ILIKE $4))
    ORDER BY t.created_at DESC
    LIMIT 1
    `,
    [isrc || null, upc || null, trackTitle || null, trackTitle ? `%${trackTitle}%` : "%"]
  );

  return result.rows[0] || null;
};

const validateMetadataImportRows = async (rows) => {
  const seenIsrcs = new Set();
  const seenUpcs = new Set();
  const previewRows = [];

  for (const [index, row] of rows.entries()) {
    const upc = normalizeRowValue(row, ["UPC", "upc"]);
    const isrc = normalizeRowValue(row, ["ISRC", "isrc"]);
    const releaseTitle = normalizeRowValue(row, ["Release Title", "release_title", "title"]);
    const songName = normalizeRowValue(row, ["Song Name", "Track Title", "song_name", "title"]);
    const errors = [];
    const warnings = [];

    if (!releaseTitle) {
      errors.push("Missing release title.");
    }
    if (!songName) {
      errors.push("Missing song name.");
    }
    if (upc && seenUpcs.has(upc)) {
      warnings.push("Duplicate UPC in import file.");
    }
    if (isrc && seenIsrcs.has(isrc.toUpperCase())) {
      warnings.push("Duplicate ISRC in import file.");
    }

    if (upc) {
      seenUpcs.add(upc);
    }
    if (isrc) {
      seenIsrcs.add(isrc.toUpperCase());
    }

    previewRows.push({
      row_number: index + 2,
      upc,
      isrc,
      release_title: releaseTitle,
      song_name: songName,
      platform: normalizeRowValue(row, ["Platform", "platform"]),
      platform_url: normalizeRowValue(row, ["URL", "Platform URL", "platform_url"]),
      errors,
      warnings,
      raw_data: row,
    });
  }

  if (seenUpcs.size || seenIsrcs.size) {
    const duplicateResult = await pool.query(
      `
      SELECT 'upc' AS type, upc AS value
      FROM releases
      WHERE upc = ANY($1::text[])
      UNION ALL
      SELECT 'isrc' AS type, isrc AS value
      FROM tracks
      WHERE UPPER(isrc) = ANY($2::text[])
      `,
      [[...seenUpcs], [...seenIsrcs]]
    );

    const duplicateCodes = new Set(duplicateResult.rows.map((item) => `${item.type}:${String(item.value).toUpperCase()}`));
    for (const row of previewRows) {
      if (row.upc && duplicateCodes.has(`upc:${row.upc.toUpperCase()}`)) {
        row.warnings.push("UPC already exists in catalog.");
      }
      if (row.isrc && duplicateCodes.has(`isrc:${row.isrc.toUpperCase()}`)) {
        row.warnings.push("ISRC already exists in catalog.");
      }
    }
  }

  return previewRows;
};

const validateStructuredMetadataRows = async (rows, requestedFormat, settings) => {
  const formatVersion = detectMetadataFormat(rows, requestedFormat, settings);
  const seenIsrcs = new Set();
  const seenUpcs = new Set();
  const mappedRows = rows.map((row, index) => {
    const mapped = mapMetadataRow(row, formatVersion, settings);
    const validation = validateMetadataRow(mapped, formatVersion, settings, { seenIsrcs, seenUpcs });
    return {
      row_number: index + 2,
      format_version: formatVersion,
      raw_data: mapped.raw,
      normalized_data: mapped.normalized,
      errors: validation.errors,
      warnings: validation.warnings,
      unknown_headers: validation.unknownHeaders,
    };
  });

  const isrcs = mappedRows.map((row) => row.normalized_data.isrc).filter(Boolean);
  const upcs = mappedRows.map((row) => row.normalized_data.upc).filter(Boolean);

  if (isrcs.length || upcs.length) {
    const duplicateResult = await pool.query(
      `
      SELECT 'upc' AS type, UPPER(upc) AS value
      FROM releases
      WHERE upc IS NOT NULL AND UPPER(upc) = ANY($1::text[])
      UNION ALL
      SELECT 'isrc' AS type, UPPER(isrc) AS value
      FROM tracks
      WHERE isrc IS NOT NULL AND UPPER(isrc) = ANY($2::text[])
      `,
      [upcs.map((upc) => String(upc).toUpperCase()), isrcs.map((isrc) => String(isrc).toUpperCase())]
    );

    const duplicateCodes = new Set(duplicateResult.rows.map((item) => `${item.type}:${item.value}`));
    mappedRows.forEach((row) => {
      if (row.normalized_data.upc && duplicateCodes.has(`upc:${String(row.normalized_data.upc).toUpperCase()}`)) {
        row.errors.push("UPC already exists in catalog.");
      }
      if (row.normalized_data.isrc && duplicateCodes.has(`isrc:${String(row.normalized_data.isrc).toUpperCase()}`)) {
        row.errors.push("ISRC already exists in catalog.");
      }
    });
  }

  const validRows = mappedRows.filter((row) => row.errors.length === 0).length;
  const failedRows = mappedRows.length - validRows;

  return {
    formatVersion,
    rows: mappedRows,
    summary: {
      total_rows: mappedRows.length,
      success_count: validRows,
      failed_rows: failedRows,
      warning_rows: mappedRows.filter((row) => row.warnings.length > 0).length,
      detected_format: formatVersion,
    },
  };
};

const releaseFromNormalizedRows = (rows, req, importId, formatVersion, uploadedTemplateType) => {
  const first = rows[0]?.normalized_data || {};
  const tracks = rows.map((row) => row.normalized_data);
  const releaseType = tracks.length > 1 ? "album" : first.release_type || "single";

  return {
    release: {
      release_type: releaseType,
      title: first.release_title,
      release_title: first.release_title,
      primary_artist: first.primary_artist,
      featured_artists: first.featuring_artist,
      label_name: first.label_name,
      sub_label_name: first.sub_label_name,
      genre: first.genre,
      sub_genre: first.subgenre,
      language: first.language,
      original_release_date: first.original_release_date,
      release_date: first.release_date || first.go_live_date || first.original_release_date,
      go_live_date: first.go_live_date,
      upc: first.upc,
      copyright_owner: first.copyright_holder || first.copyright_line,
      copyright_holder: first.copyright_holder || first.copyright_line,
      copyright_line: first.copyright_line,
      publisher: first.publisher,
      explicit: first.explicit,
      notes: first.metadata_notes,
      internal_notes: null,
      territory_mode: first.territory || "worldwide",
      included_territories: [],
      excluded_territories: [],
      store_selection: first.platforms || [],
      distribution_type: "standard",
      promotional_release: false,
      status: "draft",
      current_owner: String(req.user.id),
      previous_owner: null,
      ownership_transferable: true,
      artist_id: null,
      label_id: null,
      metadata_format_version: formatVersion,
      uploaded_template_type: uploadedTemplateType,
      metadata_import_id: importId,
      metadata_raw: rows.map((row) => row.raw_data),
    },
    tracks: tracks.map((track) => ({
      title: track.track_title,
      song_name: track.track_title,
      primary_artist: track.primary_artist,
      featuring_artist: track.featuring_artist,
      remixer: track.remixer,
      isrc: track.isrc,
      iswc: track.iswc,
      composer: track.composer,
      lyricist: track.lyricist,
      producer: track.producer,
      director: track.director,
      star_cast: track.star_cast,
      description: track.description || track.metadata_notes,
      duration: track.duration,
      version: track.version,
      language: track.language,
      genre: track.genre,
      subgenre: track.subgenre,
      mood: track.mood,
      explicit: track.explicit,
      instrumental: track.instrumental,
      preview_start_time: track.preview_start_time,
      crbt_title: track.crbt_title,
      crbt_start_time_1: track.crbt_start_time_1,
      crbt_start_time_2: track.crbt_start_time_2,
      dolby_atmos: track.dolby_atmos,
      metadata_raw: track,
      contributors: track.contributors ? [track.contributors] : [],
      platforms: track.platforms || [],
    })),
  };
};

const insertMetadataDraftRelease = async (client, req, groupedRows, importId, formatVersion, uploadedTemplateType) => {
  let { release, tracks } = releaseFromNormalizedRows(groupedRows, req, importId, formatVersion, uploadedTemplateType);
  ({ release, tracks } = await prepareCatalogPayload(client, release, tracks, { user: req.user }));

  const releaseFields = [
    "release_type",
    "title",
    "release_title",
    "permalink_slug",
    "primary_artist",
    "featured_artists",
    "label_name",
    "sub_label_name",
    "genre",
    "sub_genre",
    "language",
    "original_release_date",
    "release_date",
    "go_live_date",
    "upc",
    "copyright_owner",
    "copyright_holder",
    "copyright_line",
    "production_year",
    "catalog_number",
    "publisher",
    "explicit",
    "notes",
    "internal_notes",
    "territory_mode",
    "included_territories",
    "excluded_territories",
    "store_selection",
    "distribution_type",
    "promotional_release",
    "status",
    "user_id",
    "created_by",
    "current_owner",
    "previous_owner",
    "ownership_transferable",
    "metadata_completion_percentage",
    "qc_status",
    "qc_score",
    "qc_warnings",
    "qc_errors",
    "delivery_status",
    "artist_id",
    "label_id",
    "metadata_format_version",
    "uploaded_template_type",
    "metadata_import_id",
    "metadata_raw",
  ];
  const releaseValues = releaseFields.map((field) => {
    if (field === "user_id") return getLegacyUserId(req.user);
    if (field === "created_by") return String(req.user.id);
    if (field === "delivery_status") return "pending";
    if (["included_territories", "excluded_territories", "store_selection", "qc_warnings", "qc_errors", "metadata_raw"].includes(field)) {
      return JSON.stringify(release[field] || (field === "metadata_raw" ? {} : []));
    }
    return release[field] ?? null;
  });

  const releaseResult = await client.query(
    `
    INSERT INTO releases (${releaseFields.join(", ")}, created_at, updated_at)
    VALUES (${releaseFields.map((_, index) => `$${index + 1}`).join(", ")}, NOW(), NOW())
    RETURNING *
    `,
    releaseValues
  );

  const releaseId = releaseResult.rows[0].id;
  const trackRows = [];
  const trackFields = [
    "release_id",
    "title",
    "song_name",
    "primary_artist",
    "featuring_artist",
    "remixer",
    "isrc",
    "iswc",
    "owner_type",
    "owner_id",
    "album_name",
    "release_date",
    "composer",
    "lyricist",
    "producer",
    "director",
    "star_cast",
    "description",
    "duration",
    "version",
    "language",
    "genre",
    "subgenre",
    "mood",
    "explicit",
    "instrumental",
    "preview_start_time",
    "crbt_title",
    "crbt_start_time_1",
    "crbt_start_time_2",
    "dolby_atmos",
    "metadata_completion_percentage",
    "qc_status",
    "qc_score",
    "qc_warnings",
    "qc_errors",
    "metadata_raw",
    "contributors",
    "platforms",
  ];

  for (const track of tracks) {
    const values = trackFields.map((field) => {
      if (field === "release_id") return releaseId;
      if (field === "owner_type") return getTrackOwnerType(req.user);
      if (field === "owner_id") return isUuid(req.user.id) ? req.user.id : null;
      if (field === "album_name") return release.title;
      if (field === "release_date") return release.release_date;
      if (["qc_warnings", "qc_errors", "metadata_raw", "contributors", "platforms"].includes(field)) {
        return JSON.stringify(track[field] || (field === "metadata_raw" ? {} : []));
      }
      return track[field] ?? null;
    });
    const result = await client.query(
      `
      INSERT INTO tracks (${trackFields.join(", ")}, created_at, updated_at)
      VALUES (${trackFields.map((_, index) => `$${index + 1}`).join(", ")}, NOW(), NOW())
      RETURNING *
      `,
      values
    );
    trackRows.push(result.rows[0]);
  }

  await updateCatalogQuality(client, releaseId, release, trackRows);
  await client.query(
    `
    INSERT INTO release_status_logs (release_id, from_status, to_status, notes, changed_by)
    VALUES ($1, NULL, 'draft', $2, $3)
    `,
    [releaseId, `Created from ${formatVersion.toUpperCase()} metadata import.`, req.user.id]
  );

  return {
    release: releaseResult.rows[0],
    tracks: trackRows,
  };
};

router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Release routes are ready",
  });
});

router.use(verifyToken);

router.get("/export/catalog", async (req, res) => {
  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can export catalog." });
    }

    const result = await pool.query(`
      SELECT
        r.id,
        r.release_type,
        r.title,
        r.primary_artist,
        r.featured_artists,
        r.label_name,
        r.genre,
        r.sub_genre,
        r.language,
        r.release_date,
        r.upc,
        r.copyright_owner,
        r.publisher,
        r.explicit,
        r.status,
        r.admin_notes,
        t.title AS track_title,
        t.isrc,
        t.composer,
        t.lyricist,
        t.producer,
        t.duration,
        t.version AS track_version,
        t.language AS track_language,
        t.explicit AS track_explicit,
        r.created_at,
        r.updated_at
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      ORDER BY r.created_at DESC
    `);

    const rows = result.rows.map((row) => ({
      ID: row.id,
      "Release Type": row.release_type,
      "Release Title": row.title,
      "Primary Artist": row.primary_artist,
      "Featured Artists": row.featured_artists,
      Label: row.label_name,
      Genre: row.genre,
      "Sub Genre": row.sub_genre,
      Language: row.language,
      "Release Date": row.release_date,
      UPC: row.upc,
      "Copyright Owner": row.copyright_owner,
      Publisher: row.publisher,
      Explicit: row.explicit ? "Yes" : "No",
      Status: row.status,
      "Admin Notes": row.admin_notes,
      "Track Title": row.track_title,
      ISRC: row.isrc,
      Composer: row.composer,
      Lyricist: row.lyricist,
      Producer: row.producer,
      Duration: row.duration,
      "Track Version": row.track_version,
      "Track Language": row.track_language,
      "Track Explicit": row.track_explicit ? "Yes" : "No",
      "Created At": row.created_at,
      "Updated At": row.updated_at,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Catalog");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nixa-catalog-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Catalog export error:", error);
    res.status(500).json({ message: error.message || "Catalog export failed." });
  }
});

const listReleasesHandler = async (req, res, legacy = false) => {
  try {
    await ensureReleaseSchema();

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const sort = req.query.sort === "release_date" ? "r.release_date DESC NULLS LAST" : "r.created_at DESC";
    const { where, values } = await buildListWhere(req);
    const paginationValues = [...values, limit, offset];

    const dataResult = await pool.query(
      `
      SELECT
        r.id,
        r.release_type,
        r.title,
        r.release_title,
        r.permalink_slug,
        r.primary_artist,
        r.featured_artists,
        r.label_name,
        r.sub_label_name,
        r.genre,
        r.language,
        r.original_release_date,
        r.release_date,
        r.go_live_date,
        r.upc,
        r.status,
        r.admin_notes,
        r.metadata_completion_percentage,
        r.qc_status,
        r.qc_score,
        r.delivery_status,
        r.user_id,
        r.created_by,
        r.current_owner,
        r.created_at,
        r.updated_at,
        t.isrc,
        COALESCE(t.track_count, 0)::int AS track_count,
        COALESCE(t.tracks, '[]'::json) AS tracks,
        af.file_path AS artwork_file_path,
        COUNT(*) OVER()::int AS total_count
      FROM releases r
      LEFT JOIN LATERAL (
        SELECT
          MIN(first_track.isrc) AS isrc,
          COUNT(*) AS track_count,
          json_agg(
            json_build_object(
              'id', first_track.id,
              'title', COALESCE(first_track.title, first_track.song_name),
              'isrc', first_track.isrc,
              'duration', first_track.duration,
              'version', first_track.version,
              'language', first_track.language,
              'genre', first_track.genre,
              'primary_artist', first_track.primary_artist,
              'explicit', COALESCE(first_track.explicit, first_track.is_explicit, false),
              'composer', first_track.composer,
              'lyricist', first_track.lyricist,
              'producer', first_track.producer,
              'metadata_completion_percentage', first_track.metadata_completion_percentage,
              'qc_status', first_track.qc_status,
              'audio_file_path', COALESCE(first_track.audio_file_path, first_track.audio_url)
            )
            ORDER BY first_track.created_at ASC, first_track.id ASC
          ) AS tracks
        FROM tracks first_track
        WHERE first_track.release_id = r.id
      ) t ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(file_path, file_url) AS file_path
        FROM release_files
        WHERE release_id = r.id AND file_type = 'artwork'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) af ON true
      ${where}
      ORDER BY ${sort}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `,
      paginationValues
    );

    const total = dataResult.rows[0]?.total_count || 0;
    const releases = dataResult.rows.map((row) => ({
      ...row,
      artwork_url: getStaticFileUrl(row.artwork_file_path),
      artwork_download_url: row.artwork_file_path ? getPublicFileUrl(row.id, "artwork") : null,
      tracks: (row.tracks || []).map((track) => ({
        ...track,
        audio_url: getStaticFileUrl(track.audio_file_path),
      })),
    }));

    const payload = {
      releases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };

    res.json(legacy ? { success: true, ...payload } : payload);
  } catch (error) {
    console.error("Release list error:", error);
    res.status(500).json({ message: error.message || "Failed to load releases." });
  }
};

const createReleaseHandler = async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "artist", "label"].includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to submit releases." });
    }

    let release = mapReleasePayload(req.body);
    let tracks = mapTrackPayloads(req.body);
    const audioIndexes = parseJsonArray(req.body.audio_indexes) || (req.files?.audio || []).map((_, index) => index);
    ({ release, tracks } = await prepareCatalogPayload(client, release, tracks, { user: req.user }));
    const errors = validateReleasePayload(release, tracks);

    if (release.status !== "draft") {
      if (!req.files?.artwork?.[0]) {
        errors.push("Artwork is required.");
      }

      const uploadedTrackIndexes = new Set(audioIndexes.map((index) => Number(index)));
      tracks.forEach((_, index) => {
        if (!uploadedTrackIndexes.has(index)) {
          errors.push(`Audio file is required for track ${index + 1}.`);
        }
      });
    }

    if (errors.length) {
      return res.status(400).json({ message: "Please fix the release form.", errors });
    }

    await client.query("BEGIN");

    const releaseResult = await client.query(
      `
      INSERT INTO releases (
        release_type,
        title,
        release_title,
        permalink_slug,
        primary_artist,
        featured_artists,
        label_name,
        sub_label_name,
        genre,
        sub_genre,
        language,
        original_release_date,
        release_date,
        go_live_date,
        upc,
        copyright_owner,
        copyright_holder,
        copyright_line,
        production_year,
        catalog_number,
        publisher,
        explicit,
        notes,
        internal_notes,
        territory_mode,
        included_territories,
        excluded_territories,
        store_selection,
        distribution_type,
        promotional_release,
        status,
        user_id,
        created_by,
        current_owner,
        previous_owner,
        ownership_transferable,
        metadata_completion_percentage,
        qc_status,
        qc_score,
        qc_warnings,
        qc_errors,
        delivery_status,
        artist_id,
        label_id,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
        $41, $42, $43, $44, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        release.release_type,
        release.title,
        release.release_title,
        release.permalink_slug,
        release.primary_artist,
        release.featured_artists,
        release.label_name,
        release.sub_label_name,
        release.genre,
        release.sub_genre,
        release.language,
        release.original_release_date,
        release.release_date,
        release.go_live_date,
        release.upc,
        release.copyright_owner,
        release.copyright_holder,
        release.copyright_line,
        release.production_year,
        release.catalog_number,
        release.publisher,
        release.explicit,
        release.notes,
        release.internal_notes,
        release.territory_mode,
        JSON.stringify(release.included_territories),
        JSON.stringify(release.excluded_territories),
        JSON.stringify(release.store_selection),
        release.distribution_type,
        release.promotional_release,
        release.status,
        getLegacyUserId(req.user),
        String(req.user.id),
        release.current_owner,
        release.previous_owner,
        release.ownership_transferable,
        release.metadata_completion_percentage,
        release.qc_status,
        release.qc_score,
        JSON.stringify(release.qc_warnings),
        JSON.stringify(release.qc_errors),
        "pending",
        release.artist_id,
        release.label_id,
      ]
    );

    const releaseId = releaseResult.rows[0].id;
    const insertedFiles = await insertReleaseFiles(client, releaseId, req.files);
    const audioPathByTrackIndex = new Map(
      audioIndexes
        .map((trackIndex, fileIndex) => [Number(trackIndex), insertedFiles.audioFiles[fileIndex]])
        .filter(([, audioPath]) => Boolean(audioPath))
    );
    const trackRows = [];

    for (const [index, track] of tracks.entries()) {
      const trackResult = await client.query(
        `
        INSERT INTO tracks (
          release_id,
          title,
          song_name,
          primary_artist,
          featuring_artist,
          remixer,
          isrc,
          iswc,
          owner_type,
          owner_id,
          album_name,
          release_date,
          composer,
          lyricist,
          producer,
          director,
          star_cast,
          description,
          duration,
          version,
          language,
          genre,
          subgenre,
          mood,
          explicit,
          instrumental,
          preview_start_time,
          tiktok_clip_start,
          crbt_title,
          crbt_start_time_1,
          crbt_start_time_2,
          dolby_atmos,
          lyrics_file,
          bitrate,
          sample_rate,
          stereo_mono,
          metadata_completion_percentage,
          qc_status,
          audio_file_path,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37, $38, $39, NOW(), NOW()
        )
        RETURNING *
        `,
        [
          releaseId,
          track.title,
          track.song_name,
          track.primary_artist,
          track.featuring_artist,
          track.remixer,
          track.isrc,
          track.iswc,
          getTrackOwnerType(req.user),
          isUuid(req.user.id) ? req.user.id : null,
          release.title,
          release.release_date,
          track.composer,
          track.lyricist,
          track.producer,
          track.director,
          track.star_cast,
          track.description,
          track.duration,
          track.version,
          track.language,
          track.genre,
          track.subgenre,
          track.mood,
          track.explicit,
          track.instrumental,
          track.preview_start_time,
          track.tiktok_clip_start,
          track.crbt_title,
          track.crbt_start_time_1,
          track.crbt_start_time_2,
          track.dolby_atmos,
          track.lyrics_file,
          track.bitrate,
          track.sample_rate,
          track.stereo_mono,
          track.metadata_completion_percentage,
          track.qc_status,
          audioPathByTrackIndex.get(index) || null,
        ]
      );

      trackRows.push(trackResult.rows[0]);
    }

    await updateCatalogQuality(client, releaseId, release, trackRows);

    await client.query(
      `
      INSERT INTO release_status_logs (release_id, from_status, to_status, notes, changed_by)
      VALUES ($1, NULL, $2, $3, $4)
      `,
      [releaseId, release.status, release.notes, req.user.id]
    );

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.create', 'release', $2, $3)
      `,
      [req.user.id, releaseId, JSON.stringify({ status: release.status })]
    );

    await client.query("COMMIT");

    const responseRelease = formatReleaseResponse(
      {
        ...releaseResult.rows[0],
        artwork_file_path: insertedFiles.artwork || null,
      },
      trackRows
    );

    res.status(201).json({
      message: release.status === "draft" ? "Release saved as draft." : "Release submitted successfully.",
      release: responseRelease,
      tracks: trackRows,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create release error:", error);
    res.status(500).json({ message: error.message || "Failed to create release." });
  } finally {
    client.release();
  }
};

router.get("/list", async (req, res) => {
  req.query.limit = req.query.limit || "100";
  await listReleasesHandler(req, res, true);
});

router.get("/", (req, res) => listReleasesHandler(req, res));

router.post("/", runUpload, createReleaseHandler);

router.post("/create", runUpload, createReleaseHandler);

router.get("/download/artwork/:id", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const release = await getReleaseById(req.params.id);

    if (!release) {
      return res.status(404).json({ message: "Release not found." });
    }

    if (!(await canReadRelease(req.user, release))) {
      return res.status(403).json({ message: "You do not have access to this artwork." });
    }

    const safePath = getSafeFilePath(release.artwork_file_path);

    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ message: "Artwork file not found." });
    }

    res.download(safePath, release.artwork_file_name || path.basename(safePath));
  } catch (error) {
    console.error("Artwork download error:", error);
    res.status(500).json({ message: error.message || "Failed to download artwork." });
  }
});

router.get("/download/audio/:id", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const release = await getReleaseById(req.params.id);

    if (!release) {
      return res.status(404).json({ message: "Release not found." });
    }

    if (!(await canReadRelease(req.user, release))) {
      return res.status(403).json({ message: "You do not have access to this audio." });
    }

    const tracks = await getTracksByReleaseId(release.id);
    const track = tracks.find((item) => item.audio_file_path);
    const safePath = getSafeFilePath(track?.audio_file_path);

    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ message: "Audio file not found." });
    }

    res.download(safePath, path.basename(safePath));
  } catch (error) {
    console.error("Audio download error:", error);
    res.status(500).json({ message: error.message || "Failed to download audio." });
  }
});

router.get("/export/metadata", async (req, res) => {
  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admin or accountant can export metadata." });
    }

    const type = String(req.query.type || "full").toLowerCase();
    const rows = await getMetadataExportRows(type);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Metadata");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="nixa-metadata-${type}-${Date.now()}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Metadata export error:", error);
    res.status(500).json({ message: error.message || "Failed to export metadata." });
  }
});

router.get("/imports/metadata", async (req, res) => {
  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can view metadata imports." });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM metadata_imports
      ORDER BY created_at DESC
      LIMIT 50
      `
    );

    res.json({ imports: result.rows });
  } catch (error) {
    console.error("Metadata import history error:", error);
    res.status(500).json({ message: error.message || "Failed to load metadata imports." });
  }
});

router.get("/metadata/formats", async (req, res) => {
  try {
    await ensureReleaseSchema();
    const settings = await getMetadataFormatSettings();
    res.json({
      success: true,
      data: {
        default_format: settings.default_format || "auto",
        formats: settings.formats || defaultMetadataFormats.formats,
      },
    });
  } catch (error) {
    console.error("Metadata format settings error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to load metadata formats." });
  }
});

router.get("/templates/metadata/:type", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const type = String(req.params.type || "v1").toLowerCase();
    const settings = await getMetadataFormatSettings();
    const formatConfig = settings.formats?.[type];

    if (!formatConfig || formatConfig.enabled === false) {
      return res.status(404).json({ success: false, message: "Metadata format is disabled or unavailable." });
    }

    const rows = buildTemplateRows(type, settings);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="nixa-metadata-template-${type}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Metadata template error:", error);
    res.status(500).json({ message: error.message || "Failed to download metadata template." });
  }
});

router.post("/import/metadata/preview", metadataUpload.single("metadata"), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!req.file) {
      return res.status(400).json({ message: "Please upload a metadata file." });
    }

    const settings = await getMetadataFormatSettings();
    const requestedFormat = normalizeText(req.body.format || req.body.import_type || req.body.uploaded_template_type) || "auto";
    const uploadedTemplateType = requestedFormat;
    const workbookRows = parseMetadataWorkbook(req.file.buffer);
    const validation = await validateStructuredMetadataRows(workbookRows, requestedFormat, settings);
    const previewRows = validation.rows;
    const validRows = validation.summary.success_count;
    const duplicateRows = previewRows.filter((row) =>
      [...row.errors, ...row.warnings].some((warning) => /duplicate|already exists/i.test(warning))
    ).length;

    await client.query("BEGIN");

    const importResult = await client.query(
      `
      INSERT INTO metadata_imports (
        import_type, format_version, uploaded_template_type, file_name, status,
        total_rows, valid_rows, error_rows, duplicate_rows, imported_by,
        validation_summary, error_report
      )
      VALUES ($1, $2, $3, $4, 'preview', $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        "metadata",
        validation.formatVersion,
        uploadedTemplateType,
        req.file.originalname,
        previewRows.length,
        validRows,
        previewRows.length - validRows,
        duplicateRows,
        req.user.id,
        JSON.stringify(validation.summary),
        JSON.stringify(previewRows.filter((row) => row.errors.length)),
      ]
    );

    for (const row of previewRows) {
      await client.query(
        `
        INSERT INTO metadata_import_rows (import_id, row_number, row_data, normalized_data, validation_errors, validation_warnings, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          importResult.rows[0].id,
          row.row_number,
          JSON.stringify(row.raw_data),
          JSON.stringify(row.normalized_data),
          JSON.stringify(row.errors),
          JSON.stringify(row.warnings),
          row.errors.length ? "error" : "valid",
        ]
      );
    }

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'metadata_import.preview', 'metadata_import', $2, $3)
      `,
      [
        req.user.id,
        importResult.rows[0].id,
        JSON.stringify({ import_type: "metadata", format_version: validation.formatVersion, total_rows: previewRows.length, file_name: req.file.originalname }),
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Metadata import preview created.",
      import: importResult.rows[0],
      rows: previewRows.slice(0, 250),
      summary: validation.summary,
      data: {
        import: importResult.rows[0],
        rows: previewRows.slice(0, 250),
        summary: validation.summary,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Metadata import preview error:", error);
    res.status(500).json({ message: error.message || "Failed to preview metadata import." });
  } finally {
    client.release();
  }
});

router.get("/imports/metadata/:id/errors", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const importResult = await pool.query("SELECT * FROM metadata_imports WHERE id = $1", [req.params.id]);
    const metadataImport = importResult.rows[0];

    if (!metadataImport) {
      return res.status(404).json({ success: false, message: "Import not found." });
    }
    if (req.user.role !== "admin" && String(metadataImport.imported_by) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "You do not have access to this import." });
    }

    const rowsResult = await pool.query(
      `
      SELECT row_number, row_data, normalized_data, validation_errors, validation_warnings, status
      FROM metadata_import_rows
      WHERE import_id = $1 AND (status = 'error' OR jsonb_array_length(validation_errors) > 0)
      ORDER BY row_number ASC
      `,
      [metadataImport.id]
    );

    const rows = rowsResult.rows.map((row) => ({
      "Row Number": row.row_number,
      Status: row.status,
      Errors: (row.validation_errors || []).join("; "),
      Warnings: (row.validation_warnings || []).join("; "),
      "Release Title": row.normalized_data?.release_title,
      "Track Title": row.normalized_data?.track_title,
      ISRC: row.normalized_data?.isrc,
      UPC: row.normalized_data?.upc,
      "Raw Data": JSON.stringify(row.row_data || {}),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Validation Errors");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="metadata-import-errors-${metadataImport.id}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Metadata error report error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to download error report." });
  }
});

router.post("/import/metadata/apply", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "artist", "label"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to create catalog drafts." });
    }

    const importId = normalizeText(req.body.import_id || req.body.importId || req.body.id || req.query.import_id || req.query.importId);
    if (!isUuid(importId)) {
      return res.status(400).json({ success: false, message: "A valid import ID is required." });
    }

    const importResult = await client.query("SELECT * FROM metadata_imports WHERE id = $1", [importId]);
    const metadataImport = importResult.rows[0];

    if (!metadataImport) {
      return res.status(404).json({ success: false, message: "Import not found." });
    }
    if (req.user.role !== "admin" && String(metadataImport.imported_by) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "You can only apply your own metadata imports." });
    }

    const rowsResult = await client.query(
      `
      SELECT *
      FROM metadata_import_rows
      WHERE import_id = $1 AND status = 'valid'
      ORDER BY row_number ASC
      `,
      [importId]
    );

    if (!rowsResult.rows.length) {
      return res.status(400).json({ success: false, message: "This import has no valid rows to create drafts from." });
    }

    const groupedRows = new Map();
    rowsResult.rows.forEach((row) => {
      const normalized = row.normalized_data || {};
      const key = normalized.upc || `${normalized.release_title || "untitled"}|${normalized.label_name || ""}`;
      if (!groupedRows.has(key)) groupedRows.set(key, []);
      groupedRows.get(key).push({
        row_id: row.id,
        row_number: row.row_number,
        raw_data: row.row_data || {},
        normalized_data: normalized,
      });
    });

    await client.query("BEGIN");

    const created = [];
    for (const group of groupedRows.values()) {
      const inserted = await insertMetadataDraftRelease(
        client,
        req,
        group,
        metadataImport.id,
        metadataImport.format_version || "auto",
        metadataImport.uploaded_template_type || "auto"
      );
      created.push(inserted.release);

      await client.query(
        `
        UPDATE metadata_import_rows
        SET status = 'imported', matched_release_id = $1
        WHERE id = ANY($2::uuid[])
        `,
        [inserted.release.id, group.map((row) => row.row_id)]
      );
    }

    await client.query(
      `
      UPDATE metadata_imports
      SET status = 'completed',
          completed_at = NOW(),
          validation_summary = COALESCE(validation_summary, '{}'::jsonb) || $2::jsonb
      WHERE id = $1
      `,
      [metadataImport.id, JSON.stringify({ created_releases: created.length, created_tracks: rowsResult.rows.length })]
    );

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'metadata_import.apply', 'metadata_import', $2, $3)
      `,
      [req.user.id, metadataImport.id, JSON.stringify({ created_releases: created.length, created_tracks: rowsResult.rows.length })]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Metadata drafts created.",
      data: {
        created_releases: created.length,
        created_tracks: rowsResult.rows.length,
        releases: created,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Metadata apply error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create metadata drafts." });
  } finally {
    client.release();
  }
});

router.post("/import/dsp-links/apply", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can apply DSP links." });
    }

    const importId = normalizeText(req.body.import_id || req.body.importId || req.body.id || req.query.import_id || req.query.importId);

    if (!isUuid(importId)) {
      return res.status(400).json({ message: "A valid import ID is required." });
    }

    const rowsResult = await client.query(
      `
      SELECT *
      FROM metadata_import_rows
      WHERE import_id = $1 AND status = 'valid'
      ORDER BY row_number ASC
      `,
      [importId]
    );

    await client.query("BEGIN");

    let linked = 0;
    let unmatched = 0;

    for (const row of rowsResult.rows) {
      const raw = row.row_data || {};
      const isrc = normalizeRowValue(raw, ["ISRC", "isrc"]);
      const platform = normalizeRowValue(raw, ["Platform", "platform"]);
      const platformUrl = normalizeRowValue(raw, ["URL", "Platform URL", "platform_url"]);
      const platformTrackId = normalizeRowValue(raw, ["Platform Track ID", "platform_track_id"]);

      if (!isrc || !platform || !platformUrl) {
        unmatched += 1;
        await client.query("UPDATE metadata_import_rows SET status = 'error', validation_errors = $1 WHERE id = $2", [
          JSON.stringify(["ISRC, platform and URL are required to apply DSP links."]),
          row.id,
        ]);
        continue;
      }

      const trackResult = await client.query(
        `
        SELECT id, release_id
        FROM tracks
        WHERE UPPER(isrc) = UPPER($1)
        LIMIT 1
        `,
        [isrc]
      );

      const track = trackResult.rows[0];

      if (!track) {
        unmatched += 1;
        await client.query("UPDATE metadata_import_rows SET status = 'unmatched', validation_warnings = $1 WHERE id = $2", [
          JSON.stringify(["No catalog track matched this ISRC."]),
          row.id,
        ]);
        continue;
      }

      await client.query(
        `
        INSERT INTO track_platform_links (release_id, track_id, platform, platform_track_id, platform_url, imported_by, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (track_id, platform)
        DO UPDATE SET platform_track_id = EXCLUDED.platform_track_id,
                      platform_url = EXCLUDED.platform_url,
                      imported_by = EXCLUDED.imported_by,
                      updated_at = NOW()
        `,
        [track.release_id, track.id, platform, platformTrackId, platformUrl, req.user.id]
      );

      await client.query(
        `
        INSERT INTO release_deliveries (release_id, track_id, platform, platform_track_id, platform_url, delivery_status, delivery_date, last_updated)
        VALUES ($1, $2, $3, $4, $5, 'live', CURRENT_DATE, NOW())
        `,
        [track.release_id, track.id, platform, platformTrackId, platformUrl]
      );

      await client.query("UPDATE metadata_import_rows SET status = 'imported', matched_release_id = $1, matched_track_id = $2 WHERE id = $3", [
        track.release_id,
        track.id,
        row.id,
      ]);
      await client.query("UPDATE releases SET delivery_status = 'live', updated_at = NOW() WHERE id = $1", [track.release_id]);
      linked += 1;
    }

    await client.query(
      `
      UPDATE metadata_imports
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1
      `,
      [importId]
    );

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'metadata_import.apply_dsp_links', 'metadata_import', $2, $3)
      `,
      [req.user.id, importId, JSON.stringify({ linked, unmatched })]
    );

    await client.query("COMMIT");

    res.json({
      message: "DSP links applied.",
      linked,
      unmatched,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("DSP link apply error:", error);
    res.status(500).json({ message: error.message || "Failed to apply DSP links." });
  } finally {
    client.release();
  }
});

router.post("/import/live-links", metadataUpload.single("links"), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin can upload live links." });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a live-link CSV or Excel file." });
    }

    const rows = parseMetadataWorkbook(req.file.buffer);

    await client.query("BEGIN");

    const importResult = await client.query(
      `
      INSERT INTO metadata_imports (import_type, file_name, status, total_rows, imported_by)
      VALUES ('live_links', $1, 'processing', $2, $3)
      RETURNING *
      `,
      [req.file.originalname, rows.length, req.user.id]
    );

    let linked = 0;
    let unmatched = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const track = await getTrackByCatalogCodes(client, row);
      if (!track) {
        unmatched += 1;
        await client.query(
          `
          INSERT INTO metadata_import_rows (import_id, row_number, row_data, validation_warnings, status)
          VALUES ($1, $2, $3, $4, 'unmatched')
          `,
          [importResult.rows[0].id, index + 2, JSON.stringify(row), JSON.stringify(["No track matched this ISRC/UPC."])]
        );
        continue;
      }

      for (const [header, value] of Object.entries(row)) {
        const platform = normalizePlatformName(header);
        const platformUrl = normalizeText(value);
        if (!platform || !platformUrl || !/^https?:\/\//i.test(platformUrl)) {
          continue;
        }

        await client.query(
          `
          INSERT INTO track_platform_links (release_id, track_id, platform, platform_url, imported_by, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (track_id, platform)
          DO UPDATE SET platform_url = EXCLUDED.platform_url,
                        imported_by = EXCLUDED.imported_by,
                        updated_at = NOW()
          `,
          [track.release_id, track.id, platform, platformUrl, req.user.id]
        );

        await client.query(
          `
          DELETE FROM release_deliveries
          WHERE release_id = $1 AND track_id = $2 AND LOWER(platform) = LOWER($3)
          `,
          [track.release_id, track.id, platform]
        );

        await client.query(
          `
          INSERT INTO release_deliveries (
            release_id, track_id, platform, platform_url, delivery_status, delivery_date, last_updated, updated_by
          )
          VALUES ($1, $2, $3, $4, 'live', CURRENT_DATE, NOW(), $5)
          `,
          [track.release_id, track.id, platform, platformUrl, req.user.id]
        );
        linked += 1;
      }
    }

    await client.query(
      `
      UPDATE metadata_imports
      SET status = 'completed',
          valid_rows = $2,
          error_rows = $3,
          completed_at = NOW(),
          validation_summary = $4
      WHERE id = $1
      `,
      [importResult.rows[0].id, linked, unmatched + skipped, JSON.stringify({ linked, unmatched, skipped })]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Live links imported.",
      data: { linked, unmatched, skipped, import: importResult.rows[0] },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Live link import error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to upload live links." });
  } finally {
    client.release();
  }
});

router.post("/import/release-status", metadataUpload.single("status"), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin can upload release status reports." });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a release status CSV or Excel file." });
    }

    const rows = parseMetadataWorkbook(req.file.buffer);

    await client.query("BEGIN");

    const importResult = await client.query(
      `
      INSERT INTO metadata_imports (import_type, file_name, status, total_rows, imported_by)
      VALUES ('release_status', $1, 'processing', $2, $3)
      RETURNING *
      `,
      [req.file.originalname, rows.length, req.user.id]
    );

    let updated = 0;
    let unmatched = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const track = await getTrackByCatalogCodes(client, row);
      if (!track) {
        unmatched += 1;
        await client.query(
          `
          INSERT INTO metadata_import_rows (import_id, row_number, row_data, validation_warnings, status)
          VALUES ($1, $2, $3, $4, 'unmatched')
          `,
          [importResult.rows[0].id, index + 2, JSON.stringify(row), JSON.stringify(["No track matched this ISRC/UPC."])]
        );
        continue;
      }

      for (const [header, value] of Object.entries(row)) {
        const platform = normalizePlatformName(header);
        const status = normalizePlatformStatus(value);
        if (!platform || !status) {
          continue;
        }

        await client.query(
          `
          DELETE FROM release_deliveries
          WHERE release_id = $1 AND track_id = $2 AND LOWER(platform) = LOWER($3)
          `,
          [track.release_id, track.id, platform]
        );
        await client.query(
          `
          INSERT INTO release_deliveries (
            release_id, track_id, platform, delivery_status, remark, rejection_reason, last_updated, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
          `,
          [
            track.release_id,
            track.id,
            platform,
            status,
            String(value || ""),
            status === "rejected" ? String(value || "") : null,
            req.user.id,
          ]
        );
        updated += 1;
      }
    }

    await client.query(
      `
      UPDATE metadata_imports
      SET status = 'completed',
          valid_rows = $2,
          error_rows = $3,
          completed_at = NOW(),
          validation_summary = $4
      WHERE id = $1
      `,
      [importResult.rows[0].id, updated, unmatched + skipped, JSON.stringify({ updated, unmatched, skipped })]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Release platform statuses imported.",
      data: { updated, unmatched, skipped, import: importResult.rows[0] },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Release status import error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to upload release status report." });
  } finally {
    client.release();
  }
});

router.post("/import/daily-play-report", metadataUpload.single("report"), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admin or accountant can upload daily play reports." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Please upload a daily play report file." });
    }

    const rows = parseMetadataWorkbook(req.file.buffer);
    const dailyRows = expandDailyPlayRows(rows, req.file.originalname);

    await client.query("BEGIN");

    const importResult = await client.query(
      `
      INSERT INTO metadata_imports (import_type, file_name, status, total_rows, imported_by)
      VALUES ('daily_play_report', $1, 'processing', $2, $3)
      RETURNING *
      `,
      [req.file.originalname, dailyRows.length, req.user.id]
    );

    let imported = 0;
    let skipped = 0;
    let unmatched = 0;
    const errors = [];

    for (const row of dailyRows) {
      const rowNumber = row.row_number;
      const isrc = row.isrc;
      const reportDate = row.report_date;
      const platform = row.platform || "Unknown";
      const country = row.country || "Unknown";
      const city = row.city || "Unknown";
      const streams = row.streams || 0;
      const listeners = row.listeners || 0;
      const playlistAdds = row.playlist_adds || 0;
      const shares = row.shares || 0;
      const followers = row.followers || 0;
      const revenue = row.revenue || 0;
      const currency = row.currency || "INR";
      const rowErrors = [];

      if (!isrc) rowErrors.push("Missing ISRC.");
      if (!reportDate) rowErrors.push("Missing report date.");

      if (rowErrors.length) {
        skipped += 1;
        errors.push({ row_number: rowNumber, errors: rowErrors });
        await client.query(
          `
          INSERT INTO metadata_import_rows (import_id, row_number, row_data, validation_errors, status)
          VALUES ($1, $2, $3, $4, 'error')
          `,
          [importResult.rows[0].id, rowNumber, JSON.stringify(row.raw_data || row), JSON.stringify(rowErrors)]
        );
        continue;
      }

      const trackResult = await client.query(
        `
        SELECT t.id, t.release_id, r.artist_id, r.upc
        FROM tracks t
        LEFT JOIN releases r ON r.id = t.release_id
        WHERE ($1::text IS NOT NULL AND UPPER(t.isrc) = UPPER($1))
           OR ($2::text IS NOT NULL AND UPPER(r.upc) = UPPER($2) AND COALESCE(t.song_name, t.title) ILIKE $3)
        LIMIT 1
        `,
        [isrc, row.upc || null, row.track_title ? `%${row.track_title}%` : "%"]
      );

      const track = trackResult.rows[0];

      if (!track) {
        unmatched += 1;
        await client.query(
          `
          INSERT INTO metadata_import_rows (import_id, row_number, row_data, validation_warnings, status)
          VALUES ($1, $2, $3, $4, 'unmatched')
          `,
          [importResult.rows[0].id, rowNumber, JSON.stringify(row.raw_data || row), JSON.stringify(["No catalog track matched this row."])]
        );
        continue;
      }

      const insertResult = await client.query(
        `
        INSERT INTO daily_track_analytics (
          track_id, release_id, report_date, platform, country, city, streams, listeners, playlist_adds, shares, followers, upc, revenue, currency
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (track_id, report_date, platform, country, city) DO NOTHING
        RETURNING id
        `,
        [track.id, track.release_id, reportDate, platform, country, city, streams, listeners, playlistAdds, shares, followers, track.upc || row.upc || null, revenue, currency]
      );

      if (track.artist_id) {
        await client.query(
          `
          INSERT INTO daily_artist_analytics (
            artist_id, report_date, platform, country, city, streams, listeners, playlist_adds, shares, followers, revenue, currency
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (artist_id, report_date, platform, country, city) DO NOTHING
          `,
          [track.artist_id, reportDate, platform, country, city, streams, listeners, playlistAdds, shares, followers, revenue, currency]
        );
      }

      await client.query(
        `
        INSERT INTO metadata_import_rows (import_id, row_number, row_data, matched_release_id, matched_track_id, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          importResult.rows[0].id,
          rowNumber,
          JSON.stringify(row.raw_data || row),
          track.release_id,
          track.id,
          insertResult.rowCount ? "imported" : "duplicate",
        ]
      );

      if (insertResult.rowCount) {
        imported += 1;
      } else {
        skipped += 1;
      }
    }

    await client.query(
      `
      UPDATE metadata_imports
      SET status = 'completed',
          valid_rows = $2,
          error_rows = $3,
          duplicate_rows = $4,
          completed_at = NOW()
      WHERE id = $1
      `,
      [importResult.rows[0].id, imported, skipped + unmatched, skipped,]
    );

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'daily_play_report.import', 'metadata_import', $2, $3)
      `,
      [req.user.id, importResult.rows[0].id, JSON.stringify({ imported, skipped, unmatched, total_rows: dailyRows.length })]
    );

    await client.query("COMMIT");

    res.json({
      message: "Daily play report uploaded.",
      import: { ...importResult.rows[0], status: "completed" },
      summary: {
        total_rows: rows.length,
        expanded_rows: dailyRows.length,
        imported,
        skipped,
        unmatched,
        errors: errors.slice(0, 25),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Daily play report import error:", error);
    res.status(500).json({ message: error.message || "Failed to upload daily play report." });
  } finally {
    client.release();
  }
});

router.post("/bulk/status", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can bulk update release status." });
    }

    const releaseIds = Array.isArray(req.body.releaseIds) ? req.body.releaseIds.map(String).filter(Boolean) : [];
    const status = normalizeStatus(req.body.status, null);
    const notes = normalizeText(req.body.admin_notes) || "Bulk status update.";

    if (!releaseIds.length) {
      return res.status(400).json({ message: "Select at least one release." });
    }
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    await client.query("BEGIN");

    const existingResult = await client.query(
      `SELECT id, status FROM releases WHERE id::text = ANY($1::text[])`,
      [releaseIds]
    );

    for (const release of existingResult.rows) {
      await client.query(
        `
        UPDATE releases
        SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW()
        WHERE id = $3
        `,
        [status, notes, release.id]
      );
      await client.query(
        `
        INSERT INTO release_status_logs (release_id, from_status, to_status, notes, changed_by)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [release.id, release.status, status, notes, req.user.id]
      );
    }

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.bulk_status', 'release', NULL, $2)
      `,
      [req.user.id, JSON.stringify({ release_ids: releaseIds, status })]
    );

    await client.query("COMMIT");

    res.json({ message: "Bulk status update complete.", updated: existingResult.rowCount });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk status update error:", error);
    res.status(500).json({ message: error.message || "Failed to bulk update status." });
  } finally {
    client.release();
  }
});

router.post("/bulk/transfer", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can transfer release ownership." });
    }

    const releaseIds = Array.isArray(req.body.releaseIds) ? req.body.releaseIds.map(String).filter(Boolean) : [];
    const newOwner = normalizeText(req.body.new_owner);
    const reason = normalizeText(req.body.reason) || "Bulk ownership transfer.";

    if (!releaseIds.length || !newOwner) {
      return res.status(400).json({ message: "Release IDs and new owner are required." });
    }

    await client.query("BEGIN");

    const existingResult = await client.query(
      `SELECT id, current_owner FROM releases WHERE id::text = ANY($1::text[])`,
      [releaseIds]
    );

    for (const release of existingResult.rows) {
      await client.query(
        `
        UPDATE releases
        SET previous_owner = current_owner,
            current_owner = $1,
            ownership_transferable = TRUE,
            updated_at = NOW()
        WHERE id = $2
        `,
        [newOwner, release.id]
      );
      await client.query(
        `
        INSERT INTO ownership_transfer_logs (release_id, old_owner, new_owner, transferred_by, reason)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [release.id, release.current_owner, newOwner, req.user.id, reason]
      );
    }

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.bulk_transfer', 'release', NULL, $2)
      `,
      [req.user.id, JSON.stringify({ release_ids: releaseIds, new_owner: newOwner })]
    );

    await client.query("COMMIT");

    res.json({ message: "Bulk ownership transfer complete.", updated: existingResult.rowCount });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk transfer error:", error);
    res.status(500).json({ message: error.message || "Failed to transfer ownership." });
  } finally {
    client.release();
  }
});

router.get("/qc/dashboard", async (req, res) => {
  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admin or accountant can view QC operations." });
    }

    const [summary, pending, failed, trends, queueSummary] = await Promise.all([
      pool.query(
        `
        SELECT
          COUNT(*)::int AS total_releases,
          COUNT(*) FILTER (WHERE qc_status = 'failed')::int AS failed_qc,
          COUNT(*) FILTER (WHERE qc_status = 'warning')::int AS warning_qc,
          COUNT(*) FILTER (WHERE qc_status = 'passed')::int AS passed_qc,
          COUNT(*) FILTER (WHERE status IN ('submitted', 'under_review', 'metadata_qc', 'artwork_qc', 'audio_qc'))::int AS pending_review,
          ROUND(COALESCE(AVG(NULLIF(qc_score, 0)), 0))::int AS average_qc_score,
          ROUND(COALESCE(AVG(NULLIF(release_health_score, 0)), 0))::int AS average_health_score
        FROM releases
        WHERE deleted_at IS NULL
        `
      ),
      pool.query(
        `
        SELECT id, COALESCE(release_title, title) AS release_title, primary_artist, label_name, status, qc_status, qc_score,
               release_health_score, metadata_completion_percentage, updated_at
        FROM releases
        WHERE deleted_at IS NULL
          AND (status IN ('submitted', 'under_review', 'metadata_qc', 'artwork_qc', 'audio_qc') OR qc_status IN ('pending', 'failed', 'warning'))
        ORDER BY updated_at DESC
        LIMIT 12
        `
      ),
      pool.query(
        `
        SELECT rqr.*, COALESCE(r.release_title, r.title) AS release_title, r.primary_artist
        FROM release_qc_reports rqr
        JOIN releases r ON r.id = rqr.release_id
        WHERE rqr.status = 'failed'
        ORDER BY rqr.created_at DESC
        LIMIT 12
        `
      ),
      pool.query(
        `
        SELECT DATE_TRUNC('day', created_at)::date AS day,
               ROUND(AVG(qc_score))::int AS qc_score,
               ROUND(AVG(release_health))::int AS release_health,
               COUNT(*)::int AS runs
        FROM release_qc_reports
        WHERE created_at >= NOW() - INTERVAL '45 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY day ASC
        `
      ),
      pool.query(
        `
        SELECT delivery_status, COUNT(*)::int AS count
        FROM delivery_queue
        GROUP BY delivery_status
        ORDER BY count DESC
        `
      ),
    ]);

    res.json({
      success: true,
      message: "QC dashboard loaded.",
      data: {
        summary: summary.rows[0] || {},
        pendingReleases: pending.rows,
        failedReports: failed.rows,
        trends: trends.rows,
        deliveryQueue: queueSummary.rows,
      },
    });
  } catch (error) {
    console.error("QC dashboard error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to load QC dashboard." });
  }
});

router.get("/qc/:id", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const release = await getReleaseById(req.params.id);
    if (!release) {
      return res.status(404).json({ success: false, message: "Release not found." });
    }

    if (!(await canReadRelease(req.user, release))) {
      return res.status(403).json({ success: false, message: "You do not have access to this release." });
    }

    const [tracks, qcDetails, deliveryQueue, deliveries, files] = await Promise.all([
      getTracksByReleaseId(release.id),
      getLatestQcReport(release.id),
      getDeliveryQueueRows(release.id),
      getReleaseDeliveries(release.id),
      getReleaseFiles(release.id),
    ]);

    res.json({
      success: true,
      message: "QC details loaded.",
      data: {
        release: formatReleaseResponse(release, tracks),
        tracks,
        files,
        report: qcDetails.latest,
        trackReports: qcDetails.tracks,
        conflicts: qcDetails.conflicts,
        locks: qcDetails.locks,
        deliveryQueue,
        deliveries,
      },
    });
  } catch (error) {
    console.error("QC details error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to load QC details." });
  }
});

router.post("/bulk/qc", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admin or accountant can run bulk QC." });
    }

    const releaseIds = Array.isArray(req.body.release_ids || req.body.releaseIds) ? req.body.release_ids || req.body.releaseIds : [];
    if (!releaseIds.length) {
      return res.status(400).json({ success: false, message: "Select at least one release." });
    }

    await client.query("BEGIN");
    const results = [];

    for (const releaseId of releaseIds) {
      const inputs = await loadReleaseQcInputs(client, releaseId);
      if (!inputs) {
        results.push({ release_id: releaseId, status: "missing" });
        continue;
      }

      const qc = await persistAdvancedQcReport(client, { ...inputs, userId: req.user.id });
      results.push({
        release_id: inputs.release.id,
        status: qc.status,
        qc_score: qc.qcScore,
        release_health: qc.releaseHealth,
      });
    }

    await client.query("COMMIT");

    res.json({ success: true, message: "Bulk QC complete.", data: { results } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk QC error:", error);
    res.status(500).json({ success: false, message: error.message || "Bulk QC failed." });
  } finally {
    client.release();
  }
});

router.post("/bulk/queue-delivery", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admin or accountant can queue delivery." });
    }

    const releaseIds = Array.isArray(req.body.release_ids || req.body.releaseIds) ? req.body.release_ids || req.body.releaseIds : [];
    if (!releaseIds.length) {
      return res.status(400).json({ success: false, message: "Select at least one release." });
    }

    await client.query("BEGIN");
    const results = [];

    for (const releaseId of releaseIds) {
      const inputs = await loadReleaseQcInputs(client, releaseId);
      if (!inputs) {
        results.push({ release_id: releaseId, status: "missing" });
        continue;
      }

      const queued = await queueReleaseDelivery(client, {
        release: inputs.release,
        tracks: inputs.tracks,
        platforms: req.body.platforms,
        priority: Number(req.body.priority || 5),
        userId: req.user.id,
        message: normalizeText(req.body.notes) || "Bulk queued for DSP delivery.",
      });
      results.push({ release_id: inputs.release.id, delivery_status: queued.delivery_status, platforms: queued.platforms });
    }

    await client.query("COMMIT");

    res.json({ success: true, message: "Bulk delivery queue updated.", data: { results } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk delivery queue error:", error);
    res.status(500).json({ success: false, message: error.message || "Bulk delivery queue failed." });
  } finally {
    client.release();
  }
});

router.get("/delivery/queue", async (req, res) => {
  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admin or accountant can view delivery queue." });
    }

    const status = normalizeText(req.query.status);
    const search = normalizeText(req.query.search);
    const values = [];
    const conditions = [];

    if (status) {
      values.push(status);
      conditions.push(`dq.delivery_status = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(dq.platform ILIKE $${values.length} OR r.release_title ILIKE $${values.length} OR r.title ILIKE $${values.length} OR t.isrc ILIKE $${values.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `
      SELECT dq.*, COALESCE(r.release_title, r.title) AS release_title, r.primary_artist,
             COALESCE(t.song_name, t.title) AS track_title, t.isrc
      FROM delivery_queue dq
      JOIN releases r ON r.id = dq.release_id
      LEFT JOIN tracks t ON t.id = dq.track_id
      ${where}
      ORDER BY
        CASE dq.delivery_status
          WHEN 'retry_pending' THEN 1
          WHEN 'queued' THEN 2
          WHEN 'retrying' THEN 3
          WHEN 'delivering' THEN 4
          WHEN 'failed' THEN 5
          ELSE 6
        END,
        dq.priority ASC,
        dq.updated_at DESC
      LIMIT 100
      `,
      values
    );

    res.json({ success: true, message: "Delivery queue loaded.", data: { queue: result.rows } });
  } catch (error) {
    console.error("Delivery queue error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to load delivery queue." });
  }
});

router.patch("/delivery/queue/:queueId/status", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admin or accountant can update delivery status." });
    }

    const status = normalizeDeliveryStatus(req.body.status, null);
    if (!status) {
      return res.status(400).json({ success: false, message: "Invalid delivery status." });
    }

    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM delivery_queue WHERE id = $1", [req.params.queueId]);
    const queue = existing.rows[0];
    if (!queue) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Delivery queue item not found." });
    }

    const nextRetry = ["failed", "retry_failed"].includes(status) ? new Date(Date.now() + 6 * 60 * 60 * 1000) : null;
    const updated = await client.query(
      `
      UPDATE delivery_queue
      SET delivery_status = $1,
          last_attempt = CASE WHEN $1 IN ('delivering', 'retrying', 'delivered', 'live', 'failed', 'retry_failed') THEN NOW() ELSE last_attempt END,
          next_retry = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [status, nextRetry, queue.id]
    );

    await client.query(
      `
      UPDATE release_deliveries
      SET delivery_status = $1,
          last_updated = NOW(),
          delivery_notes = $2,
          updated_by = $3,
          delivery_date = CASE WHEN $1 IN ('delivered', 'live') THEN COALESCE(delivery_date, CURRENT_DATE) ELSE delivery_date END
      WHERE release_id = $4
        AND COALESCE(track_id::text, '') = COALESCE($5, '')
        AND LOWER(platform) = LOWER($6)
      `,
      [status, normalizeText(req.body.notes), req.user.id, queue.release_id, queue.track_id, queue.platform]
    );

    await appendDeliveryLog(client, {
      queueId: queue.id,
      releaseId: queue.release_id,
      trackId: queue.track_id,
      platform: queue.platform,
      action: "status",
      oldStatus: queue.delivery_status,
      newStatus: status,
      message: normalizeText(req.body.notes) || `Delivery status changed to ${status}.`,
      userId: req.user.id,
    });

    const deliveryStatus = await syncReleaseDeliveryStatus(client, queue.release_id);
    if (status === "live") {
      await client.query("UPDATE releases SET status = 'live', delivery_status = 'live', updated_at = NOW() WHERE id = $1", [queue.release_id]);
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Delivery status updated.",
      data: { queue: updated.rows[0], delivery_status: status === "live" ? "live" : deliveryStatus },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delivery status update error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to update delivery status." });
  } finally {
    client.release();
  }
});

router.get("/takedowns", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const values = [];
    const conditions = [];
    let scopeClause = "";

    if (!["admin", "accountant"].includes(req.user.role)) {
      const scope = await getReleaseScope(req.user);
      if (!scope.clause) {
        return res.json({ success: true, message: "Takedowns loaded.", data: { takedowns: [] } });
      }
      values.push(...scope.values);
      scopeClause = scope.clause;
      conditions.push(scopeClause);
    }

    if (req.query.status) {
      values.push(req.query.status);
      conditions.push(`td.status = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `
      SELECT td.*, COALESCE(r.release_title, r.title) AS release_title, r.primary_artist,
             COALESCE(t.song_name, t.title) AS track_title, t.isrc
      FROM takedown_requests td
      JOIN releases r ON r.id = td.release_id
      LEFT JOIN tracks t ON t.id = td.track_id
      ${where}
      ORDER BY td.created_at DESC
      LIMIT 100
      `,
      values
    );

    res.json({ success: true, message: "Takedowns loaded.", data: { takedowns: result.rows } });
  } catch (error) {
    console.error("Takedown list error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to load takedowns." });
  }
});

router.patch("/takedowns/:id/status", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admin or accountant can manage takedowns." });
    }

    const status = normalizeText(req.body.status)?.toLowerCase();
    if (!allowedTakedownStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid takedown status." });
    }

    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM takedown_requests WHERE id = $1", [req.params.id]);
    const takedown = existing.rows[0];
    if (!takedown) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Takedown request not found." });
    }

    const updated = await client.query(
      `
      UPDATE takedown_requests
      SET status = $1,
          approved_by = CASE WHEN $1 IN ('processing', 'completed') THEN $2 ELSE approved_by END,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [status, req.user.id, takedown.id]
    );

    if (status === "processing") {
      await client.query(
        `
        UPDATE release_deliveries
        SET delivery_status = 'takedown_requested',
            last_updated = NOW(),
            updated_by = $1
        WHERE release_id = $2
          AND ($3::uuid IS NULL OR track_id = $3::uuid)
          AND ($4::text IS NULL OR LOWER(platform) = LOWER($4))
        `,
        [req.user.id, takedown.release_id, takedown.track_id, takedown.platform]
      );
      await client.query("UPDATE releases SET status = 'takedown_requested', updated_at = NOW() WHERE id = $1", [takedown.release_id]);
    }

    if (status === "completed") {
      await client.query(
        `
        UPDATE release_deliveries
        SET delivery_status = 'removed',
            last_updated = NOW(),
            updated_by = $1
        WHERE release_id = $2
          AND ($3::uuid IS NULL OR track_id = $3::uuid)
          AND ($4::text IS NULL OR LOWER(platform) = LOWER($4))
        `,
        [req.user.id, takedown.release_id, takedown.track_id, takedown.platform]
      );
      if (takedown.takedown_type === "full" && !takedown.platform) {
        await client.query("UPDATE releases SET status = 'takedown_complete', delivery_status = 'removed', updated_at = NOW() WHERE id = $1", [
          takedown.release_id,
        ]);
      } else {
        await syncReleaseDeliveryStatus(client, takedown.release_id);
      }
    }

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.takedown_status', 'takedown', $2, $3)
      `,
      [req.user.id, takedown.id, JSON.stringify({ from: takedown.status, to: status, release_id: takedown.release_id })]
    );

    await client.query("COMMIT");

    res.json({ success: true, message: "Takedown status updated.", data: { takedown: updated.rows[0] } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Takedown status error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to update takedown status." });
  } finally {
    client.release();
  }
});

router.post("/:id/qc/run", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admin or accountant can run QC." });
    }

    const inputs = await loadReleaseQcInputs(client, req.params.id);
    if (!inputs) {
      return res.status(404).json({ success: false, message: "Release not found." });
    }

    await client.query("BEGIN");
    const qc = await persistAdvancedQcReport(client, { ...inputs, userId: req.user.id });

    if (qc.status === "failed") {
      await createNotification({
        userId: inputs.release.created_by,
        title: "Release QC failed",
        message: `${inputs.release.release_title || inputs.release.title} needs QC corrections before delivery.`,
        type: "qc",
        metadata: { release_id: inputs.release.id, qc_score: qc.qcScore, errors: qc.errors.slice(0, 5) },
        client,
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "QC run complete.",
      data: {
        report: qc.report,
        qcScore: qc.qcScore,
        releaseHealth: qc.releaseHealth,
        status: qc.status,
        warnings: qc.warnings,
        errors: qc.errors,
        suggestions: qc.suggestions,
        conflicts: qc.conflicts,
        trackReports: qc.trackReports,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Run QC error:", error);
    res.status(500).json({ success: false, message: error.message || "QC run failed." });
  } finally {
    client.release();
  }
});

router.post("/:id/queue-delivery", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admin or accountant can queue delivery." });
    }

    const inputs = await loadReleaseQcInputs(client, req.params.id);
    if (!inputs) {
      return res.status(404).json({ success: false, message: "Release not found." });
    }

    const force = req.body.force === true;
    if (!force && !["approved", "scheduled", "delivered", "live"].includes(inputs.release.status)) {
      return res.status(400).json({ success: false, message: "Approve the release before queueing DSP delivery." });
    }

    await client.query("BEGIN");
    const queued = await queueReleaseDelivery(client, {
      release: inputs.release,
      tracks: inputs.tracks,
      platforms: req.body.platforms,
      priority: Number(req.body.priority || 5),
      userId: req.user.id,
      message: normalizeText(req.body.notes) || "Queued for DSP delivery.",
    });

    await createNotification({
      userId: inputs.release.created_by,
      title: "Release queued for delivery",
      message: `${inputs.release.release_title || inputs.release.title} is queued for DSP delivery.`,
      type: "delivery",
      metadata: { release_id: inputs.release.id, platforms: queued.platforms },
      client,
    });

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Release queued for DSP delivery.",
      data: {
        ...queued,
        deliveries: await getReleaseDeliveries(inputs.release.id),
        deliveryQueue: await getDeliveryQueueRows(inputs.release.id),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Queue delivery error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to queue delivery." });
  } finally {
    client.release();
  }
});

router.post("/:id/delivery/:queueId/retry", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admin or accountant can retry delivery." });
    }

    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT * FROM delivery_queue WHERE id = $1 AND release_id::text = $2",
      [req.params.queueId, req.params.id]
    );
    const queue = existing.rows[0];
    if (!queue) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Delivery queue item not found." });
    }

    const updated = await client.query(
      `
      UPDATE delivery_queue
      SET delivery_status = 'retry_pending',
          retry_count = retry_count + 1,
          next_retry = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [queue.id]
    );

    await client.query(
      `
      UPDATE release_deliveries
      SET delivery_status = 'retry_pending',
          last_updated = NOW(),
          delivery_notes = $1,
          updated_by = $2
      WHERE release_id = $3
        AND COALESCE(track_id::text, '') = COALESCE($4, '')
        AND LOWER(platform) = LOWER($5)
      `,
      [
        normalizeText(req.body.notes) || "Delivery retry queued.",
        req.user.id,
        queue.release_id,
        queue.track_id,
        queue.platform,
      ]
    );

    await appendDeliveryLog(client, {
      queueId: queue.id,
      releaseId: queue.release_id,
      trackId: queue.track_id,
      platform: queue.platform,
      action: "retry",
      oldStatus: queue.delivery_status,
      newStatus: "retry_pending",
      message: normalizeText(req.body.notes) || "Delivery retry queued.",
      userId: req.user.id,
    });

    const deliveryStatus = await syncReleaseDeliveryStatus(client, queue.release_id);
    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Delivery retry queued.",
      data: { queue: updated.rows[0], delivery_status: deliveryStatus },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delivery retry error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to retry delivery." });
  } finally {
    client.release();
  }
});

router.post("/:id/takedown", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    const release = await getReleaseById(req.params.id);
    if (!release) {
      return res.status(404).json({ success: false, message: "Release not found." });
    }

    if (!(await canReadRelease(req.user, release))) {
      return res.status(403).json({ success: false, message: "You do not have access to this release." });
    }

    const reason = normalizeText(req.body.reason);
    if (!reason) {
      return res.status(400).json({ success: false, message: "Takedown reason is required." });
    }

    const takedownType = normalizeText(req.body.takedown_type || req.body.type) || (req.body.platform ? "platform" : "full");

    await client.query("BEGIN");
    const result = await client.query(
      `
      INSERT INTO takedown_requests (
        release_id, track_id, platform, territory, takedown_type, status, reason, requested_by, effective_date
      )
      VALUES ($1, $2, $3, $4, $5, 'requested', $6, $7, $8)
      RETURNING *
      `,
      [
        release.id,
        normalizeText(req.body.track_id) || null,
        normalizeText(req.body.platform) || null,
        normalizeText(req.body.territory) || null,
        takedownType,
        reason,
        req.user.id,
        req.body.effective_date || null,
      ]
    );

    await client.query(
      `
      INSERT INTO release_status_logs (release_id, from_status, to_status, notes, changed_by)
      VALUES ($1, $2, 'takedown_requested', $3, $4)
      `,
      [release.id, release.status, reason, req.user.id]
    );

    await client.query("UPDATE releases SET status = 'takedown_requested', updated_at = NOW() WHERE id = $1", [release.id]);
    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.takedown_request', 'release', $2, $3)
      `,
      [req.user.id, release.id, JSON.stringify({ takedown_id: result.rows[0].id, type: takedownType, platform: req.body.platform })]
    );

    await createNotification({
      title: "Takedown requested",
      message: `${release.release_title || release.title} has a takedown request awaiting operations review.`,
      type: "takedown",
      metadata: { release_id: release.id, takedown_id: result.rows[0].id },
      client,
    });

    await client.query("COMMIT");

    res.status(201).json({ success: true, message: "Takedown request created.", data: { takedown: result.rows[0] } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Takedown request error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to request takedown." });
  } finally {
    client.release();
  }
});

router.post("/:id/metadata/unlock", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin can override metadata locks." });
    }

    const release = await getReleaseById(req.params.id);
    if (!release) {
      return res.status(404).json({ success: false, message: "Release not found." });
    }

    const reason = normalizeText(req.body.reason);
    if (!reason) {
      return res.status(400).json({ success: false, message: "Unlock reason is required." });
    }

    await client.query("BEGIN");
    const updated = await client.query(
      `
      UPDATE releases
      SET metadata_locked = false,
          metadata_lock_reason = $1,
          metadata_unlocked_until = NOW() + INTERVAL '48 hours',
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [reason, release.id]
    );

    await client.query(
      `
      INSERT INTO metadata_lock_logs (release_id, action, reason, performed_by, locked_snapshot)
      VALUES ($1, 'unlock', $2, $3, $4)
      `,
      [
        release.id,
        reason,
        req.user.id,
        JSON.stringify({
          status: release.status,
          upc: release.upc,
          release_date: release.release_date,
          current_owner: release.current_owner,
        }),
      ]
    );

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.metadata_unlock', 'release', $2, $3)
      `,
      [req.user.id, release.id, JSON.stringify({ reason })]
    );
    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Metadata lock temporarily overridden.",
      data: { release: formatReleaseResponse(updated.rows[0], await getTracksByReleaseId(release.id)) },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Metadata unlock error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to unlock metadata." });
  } finally {
    client.release();
  }
});

router.get("/:id", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const release = await getReleaseById(req.params.id);

    if (!release) {
      return res.status(404).json({ message: "Release not found." });
    }

    if (!(await canReadRelease(req.user, release))) {
      return res.status(403).json({ message: "You do not have access to this release." });
    }

    const tracks = await getTracksByReleaseId(release.id);
    const statusLogs = await pool.query(
      `
      SELECT release_id, from_status, to_status, notes, changed_by, created_at
      FROM release_status_logs
      WHERE release_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [release.id]
    );

    const [deliveries, platformLinks, ownershipHistory, analytics, revenueHealth, files, qcDetails, deliveryQueue] = await Promise.all([
      getReleaseDeliveries(release.id),
      getReleasePlatformLinks(release.id),
      getReleaseOwnershipHistory(release.id),
      getReleaseAnalytics(release.id),
      getReleaseRevenueHealth(release.id),
      getReleaseFiles(release.id),
      getLatestQcReport(release.id),
      getDeliveryQueueRows(release.id),
    ]);

    res.json({
      release: formatReleaseResponse(release, tracks),
      tracks,
      files,
      statusLogs: statusLogs.rows,
      deliveries,
      deliveryQueue,
      platformLinks,
      ownershipHistory,
      analytics,
      revenueHealth,
      qcReport: {
        score: qcDetails.latest?.qc_score ?? release.qc_score,
        status: qcDetails.latest?.status || release.qc_status,
        completion: qcDetails.latest?.metadata_completion ?? release.metadata_completion_percentage,
        health: qcDetails.latest?.release_health ?? release.release_health_score,
        warnings: qcDetails.latest?.warnings || release.qc_warnings || [],
        errors: qcDetails.latest?.errors || release.qc_errors || [],
        categories: qcDetails.latest?.categories || {},
        suggestions: qcDetails.latest?.suggestions || [],
        conflicts: qcDetails.conflicts || [],
        tracks: qcDetails.tracks || [],
        locks: qcDetails.locks || [],
      },
    });
  } catch (error) {
    console.error("Release detail error:", error);
    res.status(500).json({ message: error.message || "Failed to load release." });
  }
});

router.post("/:id/transfer-ownership", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can transfer release ownership." });
    }

    const existing = await getReleaseById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Release not found." });
    }

    const newOwner = normalizeText(req.body.new_owner);
    const reason = normalizeText(req.body.reason) || "Ownership transfer.";

    if (!newOwner) {
      return res.status(400).json({ message: "New owner is required." });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE releases
      SET previous_owner = current_owner,
          current_owner = $1,
          ownership_transferable = TRUE,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [newOwner, existing.id]
    );

    await client.query(
      `
      INSERT INTO ownership_transfer_logs (release_id, old_owner, new_owner, transferred_by, reason)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [existing.id, existing.current_owner || existing.created_by || existing.user_id, newOwner, req.user.id, reason]
    );

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.transfer_ownership', 'release', $2, $3)
      `,
      [req.user.id, existing.id, JSON.stringify({ old_owner: existing.current_owner, new_owner: newOwner })]
    );

    await client.query("COMMIT");

    const tracks = await getTracksByReleaseId(existing.id);
    res.json({
      message: "Release ownership transferred.",
      release: formatReleaseResponse(result.rows[0], tracks),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ownership transfer error:", error);
    res.status(500).json({ message: error.message || "Failed to transfer ownership." });
  } finally {
    client.release();
  }
});

router.post("/:id/deliveries", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admin or accountant can update delivery metadata." });
    }

    const existing = await getReleaseById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Release not found." });
    }

    const deliveries = Array.isArray(req.body.deliveries) ? req.body.deliveries : [];

    await client.query("BEGIN");

    for (const item of deliveries) {
      const platform = normalizeText(item.platform);
      if (!platform) {
        continue;
      }

      const trackId = normalizeText(item.track_id) || null;

      await client.query(
        `
        DELETE FROM release_deliveries
        WHERE release_id = $1
          AND COALESCE(track_id::text, '') = COALESCE($2, '')
          AND LOWER(platform) = LOWER($3)
        `,
        [existing.id, trackId, platform]
      );

      await client.query(
        `
        INSERT INTO release_deliveries (
          release_id, track_id, platform, platform_track_id, platform_url, delivery_status, delivery_date, last_updated, delivery_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
        `,
        [
          existing.id,
          trackId,
          platform,
          normalizeText(item.platform_track_id),
          normalizeText(item.platform_url),
          normalizeDeliveryStatus(item.delivery_status, "pending"),
          item.delivery_date || null,
          normalizeText(item.delivery_notes),
        ]
      );

      if (normalizeText(item.platform_url) && trackId) {
        await client.query(
          `
          INSERT INTO track_platform_links (release_id, track_id, platform, platform_track_id, platform_url, imported_by, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (track_id, platform)
          DO UPDATE SET platform_track_id = EXCLUDED.platform_track_id,
                        platform_url = EXCLUDED.platform_url,
                        imported_by = EXCLUDED.imported_by,
                        updated_at = NOW()
          `,
          [
            existing.id,
            trackId,
            platform,
            normalizeText(item.platform_track_id),
            normalizeText(item.platform_url),
            req.user.id,
          ]
        );
      }
    }

    const statusResult = await client.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE delivery_status IN ('failed', 'rejected')) AS failed_count,
        COUNT(*) FILTER (WHERE delivery_status IN ('live')) AS live_count,
        COUNT(*) FILTER (WHERE delivery_status IN ('delivered', 'live', 'updated')) AS delivered_count,
        COUNT(*) AS total_count
      FROM release_deliveries
      WHERE release_id = $1
      `,
      [existing.id]
    );

    const statusSummary = statusResult.rows[0] || {};
    const nextDeliveryStatus =
      Number(statusSummary.failed_count) > 0
        ? "failed"
        : Number(statusSummary.live_count) > 0
          ? "live"
          : Number(statusSummary.delivered_count) > 0
            ? "delivered"
            : "pending";

    await client.query(
      `UPDATE releases SET delivery_status = $1, updated_at = NOW() WHERE id = $2`,
      [nextDeliveryStatus, existing.id]
    );

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.delivery_update', 'release', $2, $3)
      `,
      [req.user.id, existing.id, JSON.stringify({ deliveries: deliveries.length, delivery_status: nextDeliveryStatus })]
    );

    await client.query("COMMIT");

    res.json({
      message: "Delivery metadata updated.",
      delivery_status: nextDeliveryStatus,
      deliveries: await getReleaseDeliveries(existing.id),
      platformLinks: await getReleasePlatformLinks(existing.id),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delivery update error:", error);
    res.status(500).json({ message: error.message || "Failed to update delivery metadata." });
  } finally {
    client.release();
  }
});

router.delete("/:id/deliveries/:deliveryId", async (req, res) => {
  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin can delete platform links." });
    }

    const existing = await getReleaseById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Release not found." });
    }

    const result = await pool.query(
      `
      DELETE FROM release_deliveries
      WHERE id = $1 AND release_id = $2
      RETURNING track_id, platform
      `,
      [req.params.deliveryId, existing.id]
    );

    const deleted = result.rows[0];
    if (deleted?.track_id && deleted?.platform) {
      await pool.query(
        `
        DELETE FROM track_platform_links
        WHERE track_id = $1 AND LOWER(platform) = LOWER($2)
        `,
        [deleted.track_id, deleted.platform]
      );
    }

    res.json({ success: true, message: "Platform link removed." });
  } catch (error) {
    console.error("Delivery delete error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to delete platform link." });
  }
});

router.put("/:id", runUpload, async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    const existing = await getReleaseById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Release not found." });
    }

    if (!(await canEditRelease(req.user, existing))) {
      return res.status(403).json({ message: "You do not have permission to edit this release." });
    }

    const release = mapReleasePayload({ ...existing, ...req.body, status: req.body.status || existing.status });
    const track = mapTrackPayload(req.body);
    const errors = validateReleasePayload(release, track);

    if (errors.length) {
      return res.status(400).json({ message: "Please fix the release form.", errors });
    }

    await client.query("BEGIN");

    const releaseResult = await client.query(
      `
      UPDATE releases
      SET
        release_type = $1,
        title = $2,
        primary_artist = $3,
        featured_artists = $4,
        label_name = $5,
        genre = $6,
        sub_genre = $7,
        language = $8,
        release_date = $9,
        upc = $10,
        copyright_owner = $11,
        publisher = $12,
        explicit = $13,
        notes = $14,
        status = $15,
        updated_at = NOW()
      WHERE id = $16
      RETURNING *
      `,
      [
        release.release_type,
        release.title,
        release.primary_artist,
        release.featured_artists,
        release.label_name,
        release.genre,
        release.sub_genre,
        release.language,
        release.release_date,
        release.upc,
        release.copyright_owner,
        release.publisher,
        release.explicit,
        release.notes,
        release.status,
        existing.id,
      ]
    );

    const insertedFiles = await insertReleaseFiles(client, existing.id, req.files);
    const firstTrack = (await getTracksByReleaseId(existing.id))[0];
    let trackResult;

    if (firstTrack) {
      trackResult = await client.query(
        `
        UPDATE tracks
        SET
          title = $1,
          isrc = $2,
          composer = $3,
          lyricist = $4,
          producer = $5,
          duration = $6,
          version = $7,
          language = $8,
          explicit = $9,
          audio_file_path = COALESCE($10, audio_file_path)
        WHERE id = $11
        RETURNING *
        `,
        [
          track.title,
          track.isrc,
          track.composer,
          track.lyricist,
          track.producer,
          track.duration,
          track.version,
          track.language,
          track.explicit,
          insertedFiles.audio || null,
          firstTrack.id,
        ]
      );
    } else {
      trackResult = await client.query(
        `
        INSERT INTO tracks (
          release_id, title, isrc, owner_type, owner_id, album_name, release_date, composer, lyricist, producer, duration, version, language, explicit, audio_file_path
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
        `,
        [
          existing.id,
          track.title,
          track.isrc,
          getTrackOwnerType(req.user),
          isUuid(req.user.id) ? req.user.id : null,
          release.title,
          release.release_date,
          track.composer,
          track.lyricist,
          track.producer,
          track.duration,
          track.version,
          track.language,
          track.explicit,
          insertedFiles.audio || null,
        ]
      );
    }

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.update', 'release', $2, $3)
      `,
      [req.user.id, existing.id, JSON.stringify({ status: release.status })]
    );

    await client.query("COMMIT");

    res.json({
      message: "Release updated successfully.",
      release: formatReleaseResponse(
        {
          ...releaseResult.rows[0],
          artwork_file_path: insertedFiles.artwork || existing.artwork_file_path,
        },
        trackResult.rows
      ),
      tracks: trackResult.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update release error:", error);
    res.status(500).json({ message: error.message || "Failed to update release." });
  } finally {
    client.release();
  }
});

router.patch("/:id/request-update", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!["artist", "label"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only artist or label users can request release updates." });
    }

    const existing = await getReleaseById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Release not found." });
    }

    if (!(await canReadRelease(req.user, existing))) {
      return res.status(403).json({ message: "You do not have access to this release." });
    }

    if (existing.status !== "submitted") {
      return res.status(400).json({ message: "Updates can only be requested while a release is submitted." });
    }

    const notes = normalizeText(req.body.notes || req.body.admin_notes) || "Update requested by submitter.";

    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE releases
      SET status = 'update_requested', admin_notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [notes, existing.id]
    );

    await client.query(
      `
      INSERT INTO release_status_logs (release_id, from_status, to_status, notes, changed_by)
      VALUES ($1, $2, 'update_requested', $3, $4)
      `,
      [existing.id, existing.status, notes, req.user.id]
    );

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.update_request', 'release', $2, $3)
      `,
      [req.user.id, existing.id, JSON.stringify({ from: existing.status, to: "update_requested" })]
    );

    await client.query("COMMIT");

    const tracks = await getTracksByReleaseId(existing.id);
    res.json({
      message: "Update request sent to admin.",
      release: formatReleaseResponse(
        {
          ...result.rows[0],
          artwork_file_path: existing.artwork_file_path,
        },
        tracks
      ),
      tracks,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Release update request error:", error);
    res.status(500).json({ message: error.message || "Failed to request update." });
  } finally {
    client.release();
  }
});

router.patch("/:id/metadata", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    const existing = await getReleaseById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Release not found." });
    }

    if (!(await canEditMetadata(req.user, existing))) {
      return res.status(403).json({ message: "You do not have permission to edit this release metadata." });
    }

    const existingTracks = await getTracksByReleaseId(existing.id);
    const releaseInput = req.body.release && typeof req.body.release === "object" ? req.body.release : req.body;
    const release = mapReleasePayload({ ...existing, ...releaseInput, status: existing.status });
    const hasIncomingTracks = req.body.tracks !== undefined || releaseInput.tracks !== undefined;
    const tracks = hasIncomingTracks
      ? mapTrackPayloads({ tracks: req.body.tracks || releaseInput.tracks })
      : existingTracks.map((track) => mapTrackPayload(track));
    const lockedCatalogStatus = ["approved", "scheduled", "delivered", "live"].includes(existing.status);

    if (req.user.role !== "admin" && lockedCatalogStatus) {
      release.upc = existing.upc;
      release.release_date = existing.release_date;
      release.original_release_date = existing.original_release_date;
      release.go_live_date = existing.go_live_date;
    }

    const errors = validateReleasePayload(release, tracks);

    if (errors.length) {
      return res.status(400).json({ message: "Please fix the release metadata.", errors });
    }

    const nextStatus = existing.status === "draft" ? "draft" : req.user.role === "admin" ? existing.status : "submitted";

    await client.query("BEGIN");

    const prepared = await prepareCatalogPayload(client, { ...release, status: nextStatus }, tracks, {
      user: req.user,
      releaseId: existing.id,
    });
    const preparedRelease = prepared.release;
    const preparedTracks = prepared.tracks;
    const existingTrackById = new Map(existingTracks.map((track) => [String(track.id), track]));
    const existingTrackByIsrc = new Map(
      existingTracks
        .filter((track) => track.isrc)
        .map((track) => [String(track.isrc).trim().toUpperCase(), track])
    );
    const releaseFields = [
      "release_type",
      "title",
      "release_title",
      "permalink_slug",
      "primary_artist",
      "featured_artists",
      "label_name",
      "sub_label_name",
      "genre",
      "sub_genre",
      "language",
      "original_release_date",
      "release_date",
      "go_live_date",
      "upc",
      "copyright_owner",
      "copyright_holder",
      "copyright_line",
      "publisher",
      "production_year",
      "catalog_number",
      "territory_mode",
      "included_territories",
      "excluded_territories",
      "store_selection",
      "distribution_type",
      "promotional_release",
      "explicit",
      "notes",
      "internal_notes",
      "status",
      "metadata_completion_percentage",
      "qc_status",
      "qc_score",
      "qc_warnings",
      "qc_errors",
    ];
    const releaseValues = releaseFields.map((field) => {
      if (["included_territories", "excluded_territories", "store_selection", "qc_warnings", "qc_errors"].includes(field)) {
        return JSON.stringify(preparedRelease[field] || []);
      }
      return preparedRelease[field];
    });

    const releaseResult = await client.query(
      `
      UPDATE releases
      SET ${releaseFields.map((field, index) => `${field} = $${index + 1}`).join(", ")},
          updated_at = NOW()
      WHERE id = $${releaseFields.length + 1}
      RETURNING *
      `,
      [...releaseValues, existing.id]
    );

    for (const track of preparedTracks) {
      const existingTrack =
        (track.id && existingTrackById.get(String(track.id))) ||
        (track.isrc && existingTrackByIsrc.get(String(track.isrc).trim().toUpperCase()));
      const nextTrack = { ...track };

      if (req.user.role !== "admin" && lockedCatalogStatus && existingTrack?.isrc) {
        nextTrack.isrc = existingTrack.isrc;
      }

      const trackFields = [
        "title",
        "song_name",
        "isrc",
        "primary_artist",
        "featuring_artist",
        "remixer",
        "composer",
        "lyricist",
        "producer",
        "director",
        "star_cast",
        "description",
        "duration",
        "version",
        "language",
        "genre",
        "subgenre",
        "mood",
        "explicit",
        "instrumental",
        "preview_start_time",
        "tiktok_clip_start",
        "crbt_title",
        "crbt_start_time_1",
        "crbt_start_time_2",
        "dolby_atmos",
        "lyrics_file",
        "bitrate",
        "sample_rate",
        "stereo_mono",
        "metadata_completion_percentage",
        "qc_status",
        "qc_score",
        "qc_warnings",
        "qc_errors",
      ];
      const trackValues = trackFields.map((field) =>
        ["qc_warnings", "qc_errors"].includes(field) ? JSON.stringify(nextTrack[field] || []) : nextTrack[field]
      );

      if (existingTrack) {
        await client.query(
          `
          UPDATE tracks
          SET ${trackFields.map((field, index) => `${field} = $${index + 1}`).join(", ")},
              album_name = $${trackFields.length + 1},
              release_date = $${trackFields.length + 2},
              updated_at = NOW()
          WHERE id = $${trackFields.length + 3} AND release_id = $${trackFields.length + 4}
          `,
          [
            ...trackValues,
            preparedRelease.title,
            preparedRelease.release_date,
            existingTrack.id,
            existing.id,
          ]
        );
      } else {
        const insertFields = [
          "release_id",
          ...trackFields,
          "owner_type",
          "owner_id",
          "album_name",
          "release_date",
        ];
        const insertValues = [
          existing.id,
          ...trackValues,
          getTrackOwnerType(req.user),
          isUuid(req.user.id) ? req.user.id : null,
          preparedRelease.title,
          preparedRelease.release_date,
        ];

        await client.query(
          `
          INSERT INTO tracks (${insertFields.join(", ")}, created_at, updated_at)
          VALUES (${insertFields.map((_, index) => `$${index + 1}`).join(", ")}, NOW(), NOW())
          `,
          insertValues
        );
      }
    }

    const qualityTracks = await getTracksByReleaseId(existing.id);
    await updateCatalogQuality(client, existing.id, preparedRelease, qualityTracks);

    if (nextStatus !== existing.status) {
      await client.query(
        `
        INSERT INTO release_status_logs (release_id, from_status, to_status, notes, changed_by)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [existing.id, existing.status, nextStatus, "Updated metadata submitted for review.", req.user.id]
      );
    }

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.metadata_update', 'release', $2, $3)
      `,
      [req.user.id, existing.id, JSON.stringify({ status: nextStatus, track_count: tracks.length })]
    );

    await client.query("COMMIT");

    const updatedTracks = await getTracksByReleaseId(existing.id);
    const updatedRelease = await getReleaseById(existing.id);
    res.json({
      message: req.user.role === "admin" ? "Release metadata updated." : "Release metadata submitted for review.",
      release: formatReleaseResponse(
        {
          ...(updatedRelease || releaseResult.rows[0]),
          artwork_file_path: existing.artwork_file_path,
        },
        updatedTracks
      ),
      tracks: updatedTracks,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Release metadata update error:", error);
    res.status(500).json({ message: error.message || "Failed to update release metadata." });
  } finally {
    client.release();
  }
});

router.patch("/:id/submit", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();
    const existing = await getReleaseById(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, message: "Release not found." });
    }
    if (existing.status !== "draft") {
      return res.status(400).json({ success: false, message: "Only drafts can be submitted." });
    }
    if (!(await canReadRelease(req.user, existing))) {
      return res.status(403).json({ success: false, message: "You do not have access to this draft." });
    }

    const tracks = await getTracksByReleaseId(existing.id);
    const releasePayload = mapReleasePayload({ ...existing, status: "submitted" });
    const trackPayloads = tracks.map((track) => mapTrackPayload(track));
    const prepared = await prepareCatalogPayload(client, releasePayload, trackPayloads, {
      user: req.user,
      releaseId: existing.id,
    });
    const errors = validateReleasePayload(prepared.release, prepared.tracks);

    if (errors.length) {
      return res.status(400).json({ success: false, message: "Draft metadata is incomplete.", errors });
    }

    await client.query("BEGIN");
    await client.query("UPDATE releases SET status = 'submitted', updated_at = NOW() WHERE id = $1", [existing.id]);
    await updateCatalogQuality(client, existing.id, prepared.release, prepared.tracks);
    await client.query(
      `
      INSERT INTO release_status_logs (release_id, from_status, to_status, notes, changed_by)
      VALUES ($1, 'draft', 'submitted', $2, $3)
      `,
      [existing.id, normalizeText(req.body.notes) || "Draft submitted for review.", req.user.id]
    );
    await client.query("COMMIT");

    const updatedRelease = await getReleaseById(existing.id);
    res.json({
      success: true,
      message: "Draft submitted for review.",
      release: formatReleaseResponse(updatedRelease, await getTracksByReleaseId(existing.id)),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Draft submit error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to submit draft." });
  } finally {
    client.release();
  }
});

router.patch("/:id/status", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can change release status." });
    }

    const status = normalizeStatus(req.body.status, null);
    const adminNotes = normalizeText(req.body.admin_notes);

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    if (status === "rejected" && !adminNotes) {
      return res.status(400).json({ message: "Rejection reason is required." });
    }

    const existing = await getReleaseById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Release not found." });
    }

    await client.query("BEGIN");

    const updateResult = await client.query(
      `
      UPDATE releases
      SET status = $1,
          admin_notes = $2,
          metadata_locked = CASE WHEN $1 IN ('approved', 'scheduled', 'delivered', 'live') THEN true ELSE metadata_locked END,
          metadata_lock_reason = CASE WHEN $1 IN ('approved', 'scheduled', 'delivered', 'live') THEN 'Locked by catalog lifecycle status.' ELSE metadata_lock_reason END,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [status, adminNotes, existing.id]
    );

    const operationRelease = {
      ...existing,
      ...updateResult.rows[0],
      artwork_file_path: existing.artwork_file_path,
    };
    const operationTracks = await getTracksByReleaseId(existing.id);
    const operationFiles = await getReleaseFiles(existing.id, client);
    const operationDeliveries = await client
      .query("SELECT * FROM release_deliveries WHERE release_id = $1 ORDER BY platform ASC", [existing.id])
      .then((result) => result.rows);

    if (["under_review", "metadata_qc", "artwork_qc", "audio_qc", "approved"].includes(status)) {
      await persistAdvancedQcReport(client, {
        release: operationRelease,
        tracks: operationTracks,
        deliveries: operationDeliveries,
        files: operationFiles,
        userId: req.user.id,
      });
    }

    if (["approved", "scheduled"].includes(status)) {
      await client.query(
        `
        INSERT INTO metadata_lock_logs (release_id, action, reason, performed_by, locked_snapshot)
        VALUES ($1, 'lock', $2, $3, $4)
        `,
        [
          existing.id,
          "Release approved and protected for DSP delivery.",
          req.user.id,
          JSON.stringify({
            status,
            upc: operationRelease.upc,
            release_date: operationRelease.release_date,
            current_owner: operationRelease.current_owner,
          }),
        ]
      );

      await queueReleaseDelivery(client, {
        release: operationRelease,
        tracks: operationTracks,
        platforms: req.body.platforms,
        priority: Number(req.body.priority || 5),
        userId: req.user.id,
        message: `Auto queued after status changed to ${status}.`,
      });
    }

    await client.query(
      `
      INSERT INTO release_status_logs (release_id, from_status, to_status, notes, changed_by)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [existing.id, existing.status, status, adminNotes, req.user.id]
    );

    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.status', 'release', $2, $3)
      `,
      [req.user.id, existing.id, JSON.stringify({ from: existing.status, to: status })]
    );

    if (["approved", "live", "rejected"].includes(status)) {
      await createNotification({
        userId: existing.created_by,
        title: status === "rejected" ? "Release rejected" : status === "live" ? "Release is live" : "Release approved",
        message:
          status === "rejected"
            ? `${existing.release_title || existing.title} was rejected. ${adminNotes || "Please review the admin notes."}`
            : status === "live"
              ? `${existing.release_title || existing.title} is now live.`
              : `${existing.release_title || existing.title} has been approved and queued for delivery.`,
        type: status === "rejected" ? "release_rejected" : status === "live" ? "release_live" : "release_approved",
        metadata: { release_id: existing.id, status },
        client,
      });
    }

    await client.query("COMMIT");

    const tracks = await getTracksByReleaseId(existing.id);
    const updatedRelease = await getReleaseById(existing.id);

    res.json({
      message: `Release marked as ${status}.`,
      release: formatReleaseResponse(
        {
          ...(updatedRelease || updateResult.rows[0]),
          artwork_file_path: existing.artwork_file_path,
        },
        tracks
      ),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Release status error:", error);
    res.status(500).json({ message: error.message || "Failed to change release status." });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can delete releases." });
    }

    const release = await getReleaseById(req.params.id);

    if (!release) {
      return res.status(404).json({ message: "Release not found." });
    }

    const files = await pool.query("SELECT file_path FROM release_files WHERE release_id = $1", [release.id]);
    const tracks = await getTracksByReleaseId(release.id);

    await client.query("BEGIN");
    await client.query("DELETE FROM release_status_logs WHERE release_id = $1", [release.id]);
    await client.query("DELETE FROM tracks WHERE release_id = $1", [release.id]);
    await client.query("DELETE FROM release_files WHERE release_id = $1", [release.id]);
    await client.query("DELETE FROM releases WHERE id = $1", [release.id]);
    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'release.delete', 'release', $2, $3)
      `,
      [req.user.id, release.id, JSON.stringify({ title: release.title })]
    );
    await client.query("COMMIT");

    [...files.rows.map((file) => file.file_path), ...tracks.map((track) => track.audio_file_path)].forEach((storedPath) => {
      const safePath = getSafeFilePath(storedPath);

      if (safePath && fs.existsSync(safePath)) {
        fs.unlink(safePath, () => {});
      }
    });

    res.json({ message: "Release deleted successfully." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete release error:", error);
    res.status(500).json({ message: error.message || "Failed to delete release." });
  } finally {
    client.release();
  }
});

module.exports = router;
