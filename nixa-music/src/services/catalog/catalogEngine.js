const ISRC_COUNTRY = "IN";
const ISRC_REGISTRANT = "N89";

const phase9Statuses = [
  "draft",
  "submitted",
  "under_review",
  "metadata_qc",
  "artwork_qc",
  "audio_qc",
  "approved",
  "scheduled",
  "delivered",
  "live",
  "rejected",
  "takedown_requested",
  "takedown_complete",
  "archived",
  "update_requested",
  "updated",
];

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);

const toArray = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const normalizeMetadataStatus = (status, fallback = "draft") => {
  const normalized = String(status || fallback).trim().toLowerCase();
  return phase9Statuses.includes(normalized) ? normalized : fallback;
};

const calculateCompletion = (source, requiredFields) => {
  if (!requiredFields.length) {
    return 0;
  }

  const filled = requiredFields.filter((field) => {
    const value = source?.[field];
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== undefined && value !== null && String(value).trim() !== "";
  }).length;

  return Math.round((filled / requiredFields.length) * 100);
};

const releaseRequiredFields = [
  "release_type",
  "title",
  "primary_artist",
  "label_name",
  "genre",
  "language",
  "release_date",
  "copyright_holder",
  "copyright_line",
  "production_year",
];

const trackRequiredFields = [
  "title",
  "primary_artist",
  "composer",
  "lyricist",
  "producer",
  "genre",
  "language",
  "duration",
  "isrc",
];

const calculateReleaseCompletion = (release, tracks = []) => {
  const releaseScore = calculateCompletion(release, releaseRequiredFields);
  const trackScores = tracks.length ? tracks.map((track) => calculateCompletion(track, trackRequiredFields)) : [0];
  const trackScore = Math.round(trackScores.reduce((sum, score) => sum + score, 0) / trackScores.length);
  return Math.round(releaseScore * 0.55 + trackScore * 0.45);
};

const calculateTrackCompletion = (track) => calculateCompletion(track, trackRequiredFields);

const buildQcReport = ({ release, tracks = [], duplicateIsrcs = [], duplicateUpc = false }) => {
  const warnings = [];
  const errors = [];

  if (!release?.title) errors.push("Release title is missing.");
  if (!release?.primary_artist) errors.push("Primary artist is missing.");
  if (!release?.label_name) errors.push("Label name is missing.");
  if (!release?.release_date) errors.push("Release date is missing.");
  if (duplicateUpc) errors.push("UPC already exists on another release.");

  if (release?.original_release_date && release?.release_date && new Date(release.original_release_date) > new Date(release.release_date)) {
    warnings.push("Original release date is after release date.");
  }

  if (release?.upc && !/^[0-9]{12,14}$/.test(String(release.upc))) {
    warnings.push("UPC should be a 12 to 14 digit code.");
  }

  if (!tracks.length) {
    errors.push("At least one track is required.");
  }

  tracks.forEach((track, index) => {
    const trackNumber = index + 1;
    if (!track.title) errors.push(`Track ${trackNumber} title is missing.`);
    if (!track.isrc) errors.push(`Track ${trackNumber} ISRC is missing.`);
    if (track.isrc && !/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/i.test(String(track.isrc).replace(/-/g, ""))) {
      warnings.push(`Track ${trackNumber} ISRC format looks unusual.`);
    }
    if (track.explicit && String(track.description || "").toLowerCase().includes("clean")) {
      warnings.push(`Track ${trackNumber} may have explicit/clean metadata mismatch.`);
    }
  });

  duplicateIsrcs.forEach((isrc) => errors.push(`Duplicate ISRC detected: ${isrc}.`));

  const completion = calculateReleaseCompletion(release, tracks);
  const score = Math.max(0, Math.min(100, completion - errors.length * 12 - warnings.length * 4));

  return {
    score,
    completion,
    status: errors.length ? "failed" : warnings.length ? "warning" : "passed",
    warnings,
    errors,
  };
};

const generateIsrc = async (client) => {
  const year = Number(new Date().getFullYear().toString().slice(-2));
  const result = await client.query(
    `
    INSERT INTO isrc_sequences (country_code, registrant_code, year, last_sequence)
    VALUES ($1, $2, $3, 1)
    ON CONFLICT (country_code, registrant_code, year)
    DO UPDATE SET last_sequence = isrc_sequences.last_sequence + 1
    RETURNING last_sequence
    `,
    [ISRC_COUNTRY, ISRC_REGISTRANT, year]
  );
  const sequence = String(result.rows[0].last_sequence).padStart(5, "0");
  return `${ISRC_COUNTRY}${ISRC_REGISTRANT}${year}${sequence}`;
};

module.exports = {
  buildQcReport,
  calculateReleaseCompletion,
  calculateTrackCompletion,
  generateIsrc,
  normalizeMetadataStatus,
  phase9Statuses,
  slugify,
  toArray,
};
