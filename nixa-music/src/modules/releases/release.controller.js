const pool = require("../../config/db");
const { ensureReleaseSchema } = require("../../services/releaseSchema");
const {
  buildQcReport,
  calculateReleaseCompletion,
  calculateTrackCompletion,
  generateIsrc,
  normalizeMetadataStatus,
  phase9Statuses,
  slugify,
  toArray,
} = require("../../services/catalog/catalogEngine");
const {
  buildTemplateRows,
  defaultMetadataFormats,
  detectMetadataFormat,
  mapMetadataRow,
  parseDateValue,
  validateMetadataRow,
} = require("../../services/catalog/metadataFormats");
const { knownPlatforms, runAdvancedQc } = require("../../services/catalog/qcEngine");
const { createNotification } = require("../../services/notifications/notificationService");
const { getCatalogDailyPerformance } = require("../../services/daily/dailyService");

// Import helper functions from validation
const { normalizeText, normalizeBoolean, isUuid, getLegacyUserId, isIntegerId } = require("./release.validation");

const normalizeStatus = (status, fallback = "submitted") => {
  return normalizeMetadataStatus(status, fallback);
};

const normalizeReleaseType = (type) => {
  const normalized = normalizeText(type)?.toLowerCase() || "single";
  const allowedReleaseTypes = ["single", "ep", "album"];
  return allowedReleaseTypes.includes(normalized) ? normalized : "single";
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

const mapTrackPayloads = (body) => {
  const parsedTracks = Array.isArray(body.tracks) ? body.tracks : [body];
  return parsedTracks.map((track) => mapTrackPayload(track));
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

module.exports = {
  mapReleasePayload,
  mapTrackPayload,
  mapTrackPayloads,
  normalizeStatus,
  normalizeReleaseType,
  toArray,
};
