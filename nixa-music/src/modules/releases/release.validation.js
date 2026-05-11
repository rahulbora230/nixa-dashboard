const phase9Statuses = [
  "draft",
  "submitted", 
  "under_review",
  "metadata_qc",
  "artwork_qc", 
  "audio_qc",
  "approved",
  "processing",
  "delivered",
  "live",
  "rejected",
  "failed",
  "cancelled",
  "updated",
  "takedown",
  "takedown_requested",
  "removed",
  "retry_pending",
  "retrying",
  "retry_failed",
  "retry_success",
];

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

const allowedPlatforms = [
  "spotify", "apple_music", "youtube_music", "jiosaavn", 
  "wynk", "amazon", "instagram", "facebook"
];

const validateReleaseId = (id) => {
  if (!id) {
    return { valid: false, message: "Release ID is required." };
  }
  return { valid: true };
};

const validateReleasePayload = (payload) => {
  const errors = [];

  // Standardized field validation
  if (!payload.release_title || String(payload.release_title).trim() === '') {
    errors.push("Release title is required.");
  }

  if (!payload.primary_artist || String(payload.primary_artist).trim() === '') {
    errors.push("Primary artist is required.");
  }

  if (!payload.label_name || String(payload.label_name).trim() === '') {
    errors.push("Label name is required.");
  }

  if (!payload.genre || String(payload.genre).trim() === '') {
    errors.push("Genre is required.");
  }

  if (!payload.language || String(payload.language).trim() === '') {
    errors.push("Language is required.");
  }

  if (!payload.release_date || String(payload.release_date).trim() === '') {
    errors.push("Release date is required.");
  }

  // Release type validation
  if (payload.release_type && !allowedReleaseTypes.includes(payload.release_type.toLowerCase())) {
    errors.push(`Invalid release type. Must be one of: ${allowedReleaseTypes.join(", ")}`);
  }

  // Status validation
  if (payload.status && !phase9Statuses.includes(payload.status.toLowerCase())) {
    errors.push(`Invalid status. Must be one of: ${phase9Statuses.join(", ")}`);
  }

  // Delivery status validation
  if (payload.delivery_status && !allowedDeliveryStatuses.includes(payload.delivery_status.toLowerCase())) {
    errors.push(`Invalid delivery status. Must be one of: ${allowedDeliveryStatuses.join(", ")}`);
  }

  // UPC validation
  if (payload.upc && !/^[0-9]{12,14}$/.test(String(payload.upc))) {
    errors.push("UPC must be 12 to 14 digits.");
  }

  // Copyright validation
  if (payload.copyright && String(payload.copyright).trim() === '') {
    errors.push("Copyright information is required.");
  }

  // Publishing validation
  if (payload.publishing && String(payload.publishing).trim() === '') {
    errors.push("Publishing information is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateTrackPayload = (payload) => {
  const errors = [];

  // Standardized field validation
  if (!payload.track_title || String(payload.track_title).trim() === '') {
    errors.push("Track title is required.");
  }

  // ISRC validation
  if (payload.isrc && !/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(String(payload.isrc).toUpperCase())) {
    errors.push("ISRC must be in format: CC-XXX-YYYYYYYY (e.g., IN-ABC-1234567)");
  }

  // ISWC validation
  if (payload.iswc && !/^[T]-[0-9]{3}\.[0-9]{3}\.[0-9]{3}$/.test(String(payload.iswc))) {
    errors.push("ISWC must be in format: T-XXX.XXX.XXX");
  }

  // Boolean field validation
  if (payload.explicit && typeof payload.explicit !== 'boolean') {
    errors.push("Explicit flag must be a boolean value.");
  }

  if (payload.instrumental && typeof payload.instrumental !== 'boolean') {
    errors.push("Instrumental flag must be a boolean value.");
  }

  // Credits validation
  if (payload.lyricist && String(payload.lyricist).trim() === '') {
    errors.push("Lyricist name cannot be empty if provided.");
  }

  if (payload.composer && String(payload.composer).trim() === '') {
    errors.push("Composer name cannot be empty if provided.");
  }

  if (payload.producer && String(payload.producer).trim() === '') {
    errors.push("Producer name cannot be empty if provided.");
  }

  // Featuring artist validation
  if (payload.featuring_artist && String(payload.featuring_artist).trim() === '') {
    errors.push("Featuring artist name cannot be empty if provided.");
  }

  // Track number validation
  if (payload.track_number && (payload.track_number < 1 || payload.track_number > 99)) {
    errors.push("Track number must be between 1 and 99.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validatePlatformLink = (payload) => {
  const errors = [];

  if (!payload.platform) {
    errors.push("Platform is required.");
  } else if (!allowedPlatforms.includes(payload.platform.toLowerCase())) {
    errors.push(`Invalid platform. Must be one of: ${allowedPlatforms.join(", ")}`);
  }

  if (!payload.url) {
    errors.push("URL is required.");
  } else {
    try {
      new URL(payload.url);
    } catch {
      errors.push("URL must be a valid URL.");
    }
  }

  if (payload.link_type && !['release', 'track', 'preorder'].includes(payload.link_type)) {
    errors.push("Link type must be one of: release, track, preorder");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateBulkStatusPayload = (payload) => {
  const errors = [];

  if (!Array.isArray(payload.releaseIds) || payload.releaseIds.length === 0) {
    errors.push("Release IDs array is required and cannot be empty.");
  }

  if (!payload.status) {
    errors.push("Status is required.");
  } else if (!phase9Statuses.includes(payload.status.toLowerCase())) {
    errors.push(`Invalid status. Must be one of: ${phase9Statuses.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validatePlatformStatusPayload = (payload) => {
  const errors = [];

  if (!payload.platform) {
    errors.push("Platform is required.");
  } else if (!allowedPlatforms.includes(payload.platform.toLowerCase())) {
    errors.push(`Invalid platform. Must be one of: ${allowedPlatforms.join(", ")}`);
  }

  if (!payload.status) {
    errors.push("Status is required.");
  }

  const allowedPlatformStatuses = [
    "pending", "processing", "live", "rejected", "failed", "removed"
  ];

  if (payload.status && !allowedPlatformStatuses.includes(payload.status.toLowerCase())) {
    errors.push(`Invalid platform status. Must be one of: ${allowedPlatformStatuses.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateMetadataUpload = (payload) => {
  const errors = [];

  if (payload.format && !['v1', 'v2', 'auto'].includes(payload.format.toLowerCase())) {
    errors.push("Format must be one of: v1, v2, auto");
  }

  if (payload.saveAsDraft !== undefined && typeof payload.saveAsDraft !== 'boolean') {
    errors.push("saveAsDraft must be a boolean value.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Helper functions
const normalizeText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const normalizeBoolean = (value) => value === true || value === "true" || value === "1" || value === "on";

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);

const getLegacyUserId = (user) => (isIntegerId(user?.id) ? Number(user.id) : null);

const isIntegerId = (value) => /^\d+$/.test(String(value || ""));

module.exports = {
  phase9Statuses,
  allowedReleaseTypes,
  allowedDeliveryStatuses,
  allowedTakedownStatuses,
  allowedPlatforms,
  validateReleaseId,
  validateReleasePayload,
  validateTrackPayload,
  validatePlatformLink,
  validateBulkStatusPayload,
  validatePlatformStatusPayload,
  validateMetadataUpload,
  normalizeText,
  normalizeBoolean,
  isUuid,
  getLegacyUserId,
  isIntegerId
};
