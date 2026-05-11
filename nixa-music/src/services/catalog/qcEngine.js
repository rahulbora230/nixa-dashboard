const fs = require("fs");
const path = require("path");
const { calculateReleaseCompletion, calculateTrackCompletion, slugify, toArray } = require("./catalogEngine");

const knownPlatforms = [
  "Spotify",
  "Apple Music",
  "YouTube Music",
  "Amazon Music",
  "JioSaavn",
  "Wynk",
  "Gaana",
  "Boomplay",
  "Meta",
  "TikTok",
];

const knownGenres = new Set([
  "pop",
  "hip-hop",
  "hip hop",
  "rap",
  "rock",
  "indie",
  "dance",
  "electronic",
  "edm",
  "classical",
  "folk",
  "devotional",
  "bollywood",
  "punjabi",
  "regional",
  "jazz",
  "r&b",
  "soul",
  "soundtrack",
  "instrumental",
]);

const knownLanguages = new Set([
  "english",
  "hindi",
  "punjabi",
  "tamil",
  "telugu",
  "malayalam",
  "kannada",
  "bengali",
  "marathi",
  "gujarati",
  "bhojpuri",
  "urdu",
  "sanskrit",
  "instrumental",
]);

const normalizeText = (value) => String(value || "").trim();

const normalizeCode = (value) => normalizeText(value).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const isValidIsrc = (value) => /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(normalizeCode(value));

const isValidUpc = (value) => /^[0-9]{12,14}$/.test(normalizeText(value));

const titleCaseWords = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());

const isLikelyUntidyText = (value) => {
  const text = normalizeText(value);
  if (!text) return false;
  return /\s{2,}/.test(text) || (text.length > 3 && text === text.toLowerCase()) || /[^\S\r\n]+$/.test(text);
};

const getSafeUploadPath = (storedPath) => {
  if (!storedPath) return null;
  const cleaned = String(storedPath).replace(/^\/+/, "");
  const resolved = path.resolve(process.cwd(), cleaned);
  const uploadRoot = path.resolve(process.cwd(), "uploads");
  return resolved.startsWith(uploadRoot) ? resolved : null;
};

const readJpegDimensions = (buffer) => {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += 2 + length;
  }
  return null;
};

const readWebpDimensions = (buffer) => {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }

  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunk === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
};

const readImageDimensions = (storedPath) => {
  try {
    const safePath = getSafeUploadPath(storedPath);
    if (!safePath || !fs.existsSync(safePath)) {
      return null;
    }

    const buffer = fs.readFileSync(safePath);
    if (buffer.length < 24) return null;

    if (buffer.toString("hex", 0, 8) === "89504e470d0a1a0a") {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }

    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      return readJpegDimensions(buffer);
    }

    return readWebpDimensions(buffer);
  } catch {
    return null;
  }
};

const createCategory = () => ({
  score: 100,
  status: "passed",
  errors: [],
  warnings: [],
  checks: [],
});

const addIssue = (category, level, message, penalty = 4) => {
  category[level === "error" ? "errors" : "warnings"].push(message);
  category.checks.push({ level, message });
  category.score = Math.max(0, category.score - penalty);
  category.status = category.errors.length ? "failed" : category.warnings.length ? "warning" : "passed";
};

const addPass = (category, message) => {
  category.checks.push({ level: "passed", message });
};

const getReleasePlatforms = (release, tracks = []) => {
  const releaseStores = toArray(release?.store_selection);
  const trackStores = tracks.flatMap((track) => toArray(track.platforms));
  const stores = [...releaseStores, ...trackStores]
    .map((item) => normalizeText(item))
    .filter(Boolean);

  return stores.length ? [...new Set(stores)] : knownPlatforms.slice(0, 6);
};

const buildMetadataSuggestions = (release, tracks) => {
  const suggestions = [];

  [
    ["Release title", release?.title || release?.release_title],
    ["Primary artist", release?.primary_artist],
    ["Label", release?.label_name],
  ].forEach(([label, value]) => {
    if (isLikelyUntidyText(value)) {
      suggestions.push(`${label} can be normalized to "${titleCaseWords(value)}".`);
    }
  });

  tracks.forEach((track, index) => {
    if (isLikelyUntidyText(track.title || track.song_name)) {
      suggestions.push(`Track ${index + 1} title can be normalized to "${titleCaseWords(track.title || track.song_name)}".`);
    }
    if (isLikelyUntidyText(track.primary_artist)) {
      suggestions.push(`Track ${index + 1} artist can be normalized to "${titleCaseWords(track.primary_artist)}".`);
    }
  });

  return suggestions;
};

const detectCatalogConflicts = async (client, { release, tracks = [], files = [] }) => {
  if (!client || !release?.id) return [];

  const conflicts = [];
  const localIsrcs = new Map();

  tracks.forEach((track) => {
    const code = normalizeCode(track.isrc);
    if (!code) return;
    if (localIsrcs.has(code)) {
      conflicts.push({
        conflict_type: "duplicate_isrc",
        severity: "error",
        track_id: track.id || null,
        message: `ISRC ${code} appears more than once in this release.`,
        details: { isrc: code, scope: "release" },
      });
    }
    localIsrcs.set(code, track.id || true);
  });

  if (release.upc) {
    const upcResult = await client.query(
      `
      SELECT id, COALESCE(release_title, title) AS release_title
      FROM releases
      WHERE upc = $1 AND id <> $2
      LIMIT 5
      `,
      [release.upc, release.id]
    );

    upcResult.rows.forEach((row) => {
      conflicts.push({
        conflict_type: "duplicate_upc",
        severity: "error",
        message: `UPC ${release.upc} already exists on ${row.release_title || row.id}.`,
        details: { upc: release.upc, existing_release_id: row.id },
      });
    });
  }

  const isrcs = tracks.map((track) => normalizeCode(track.isrc)).filter(Boolean);
  if (isrcs.length) {
    const isrcResult = await client.query(
      `
      SELECT t.id, t.release_id, t.isrc, COALESCE(t.song_name, t.title) AS track_title
      FROM tracks t
      WHERE UPPER(REPLACE(t.isrc, '-', '')) = ANY($1::text[])
        AND t.release_id <> $2
      LIMIT 20
      `,
      [isrcs, release.id]
    );

    isrcResult.rows.forEach((row) => {
      conflicts.push({
        conflict_type: "duplicate_isrc",
        severity: "error",
        track_id: row.id,
        message: `ISRC ${row.isrc} already exists on another catalog track.`,
        details: { isrc: row.isrc, existing_release_id: row.release_id, existing_track_title: row.track_title },
      });
    });
  }

  if (release.title || release.release_title) {
    const titleResult = await client.query(
      `
      SELECT id, COALESCE(release_title, title) AS release_title, primary_artist
      FROM releases
      WHERE id <> $1
        AND LOWER(COALESCE(release_title, title, '')) = LOWER($2)
        AND LOWER(COALESCE(primary_artist, '')) = LOWER($3)
      LIMIT 10
      `,
      [release.id, release.title || release.release_title, release.primary_artist || ""]
    );

    titleResult.rows.forEach((row) => {
      conflicts.push({
        conflict_type: "same_title_artist",
        severity: "warning",
        message: `${row.release_title} by ${row.primary_artist || "unknown artist"} looks like an existing release.`,
        details: { existing_release_id: row.id },
      });
    });
  }

  const artwork = files.find((file) => file.file_type === "artwork" && file.size);
  if (artwork) {
    const artworkResult = await client.query(
      `
      SELECT release_id, file_name, size
      FROM release_files
      WHERE file_type = 'artwork'
        AND release_id <> $1
        AND size = $2
      LIMIT 8
      `,
      [release.id, artwork.size]
    );

    artworkResult.rows.forEach((row) => {
      conflicts.push({
        conflict_type: "artwork_reuse",
        severity: "warning",
        message: `Artwork size matches another release artwork (${row.file_name || "unknown file"}).`,
        details: { existing_release_id: row.release_id, file_name: row.file_name, size: row.size },
      });
    });
  }

  return conflicts;
};

const buildTrackQcReport = (track, index, release) => {
  const metadata = createCategory();
  const audio = createCategory();
  const warnings = [];
  const errors = [];

  if (!normalizeText(track.title || track.song_name)) addIssue(metadata, "error", `Track ${index + 1} title is missing.`, 14);
  else addPass(metadata, `Track ${index + 1} title present.`);

  if (!normalizeText(track.primary_artist || release?.primary_artist)) addIssue(metadata, "error", `Track ${index + 1} primary artist is missing.`, 12);
  if (!normalizeText(track.composer)) addIssue(metadata, "warning", `Track ${index + 1} composer is missing.`, 5);
  if (!normalizeText(track.lyricist) && !track.instrumental) addIssue(metadata, "warning", `Track ${index + 1} lyricist is missing.`, 5);
  if (!normalizeText(track.producer)) addIssue(metadata, "warning", `Track ${index + 1} producer is missing.`, 4);
  if (!normalizeText(track.language || release?.language)) addIssue(metadata, "warning", `Track ${index + 1} language is missing.`, 4);
  if (track.isrc && !isValidIsrc(track.isrc)) addIssue(metadata, "error", `Track ${index + 1} ISRC is invalid.`, 14);
  if (!track.isrc) addIssue(metadata, "warning", `Track ${index + 1} ISRC will need assignment before delivery.`, 4);

  const genre = normalizeText(track.genre || release?.genre).toLowerCase();
  if (genre && !knownGenres.has(genre)) addIssue(metadata, "warning", `Track ${index + 1} genre is not in the usual DSP genre set.`, 3);

  const language = normalizeText(track.language || release?.language).toLowerCase();
  if (language && !knownLanguages.has(language)) addIssue(metadata, "warning", `Track ${index + 1} language should be reviewed for DSP normalization.`, 3);

  if (!normalizeText(track.audio_file_path || track.audio_url)) {
    addIssue(audio, "error", `Track ${index + 1} audio file is missing.`, 16);
  } else {
    const safePath = getSafeUploadPath(track.audio_file_path || track.audio_url);
    if (safePath && fs.existsSync(safePath)) {
      const stats = fs.statSync(safePath);
      const extension = path.extname(safePath).toLowerCase();
      if (![".mp3", ".wav"].includes(extension)) addIssue(audio, "error", `Track ${index + 1} audio format is not MP3/WAV.`, 14);
      if (stats.size < 1024 * 200) addIssue(audio, "warning", `Track ${index + 1} audio file is unusually small.`, 6);
      if (!track.duration) addIssue(audio, "warning", `Track ${index + 1} duration is missing, so duration mismatch cannot be verified.`, 4);
      if (!track.bitrate) addIssue(audio, "warning", `Track ${index + 1} bitrate is not stored yet.`, 3);
      if (!track.sample_rate) addIssue(audio, "warning", `Track ${index + 1} sample rate is not stored yet.`, 3);
      addPass(audio, `Track ${index + 1} audio file is readable.`);
    } else {
      addIssue(audio, "warning", `Track ${index + 1} audio path is stored but the file was not found on disk.`, 8);
    }
  }

  [metadata, audio].forEach((category) => {
    warnings.push(...category.warnings);
    errors.push(...category.errors);
  });

  const completion = calculateTrackCompletion(track);
  const qcScore = Math.max(0, Math.min(100, Math.round((metadata.score * 0.55 + audio.score * 0.45 + completion) / 2)));

  return {
    track_id: track.id || null,
    qcScore,
    metadataCompletion: completion,
    status: errors.length ? "failed" : warnings.length ? "warning" : "passed",
    categories: { metadata, audio },
    warnings,
    errors,
    suggestions: buildMetadataSuggestions(release, [track]),
  };
};

const runAdvancedQc = async ({ client, release, tracks = [], deliveries = [], files = [] }) => {
  const metadata = createCategory();
  const artwork = createCategory();
  const audio = createCategory();
  const rights = createCategory();
  const delivery = createCategory();

  if (!normalizeText(release?.title || release?.release_title)) addIssue(metadata, "error", "Release title is missing.", 15);
  if (!normalizeText(release?.primary_artist)) addIssue(metadata, "error", "Release primary artist is missing.", 15);
  if (!normalizeText(release?.label_name)) addIssue(metadata, "warning", "Release label is missing.", 5);
  if (!normalizeText(release?.language)) addIssue(metadata, "warning", "Release language is missing.", 5);
  if (!normalizeText(release?.genre)) addIssue(metadata, "warning", "Release genre is missing.", 5);
  if (!release?.release_date) addIssue(metadata, "error", "Release date is missing.", 15);
  if (release?.upc && !isValidUpc(release.upc)) addIssue(metadata, "error", "UPC must be 12 to 14 numeric digits.", 14);
  if (release?.original_release_date && release?.release_date && new Date(release.original_release_date) > new Date(release.release_date)) {
    addIssue(metadata, "warning", "Original release date is after release date.", 5);
  }
  if (release?.release_type === "single" && tracks.length > 1) addIssue(metadata, "error", "Single releases can only contain one track.", 15);
  if (!tracks.length) addIssue(metadata, "error", "At least one track is required.", 18);

  const artworkFile = files.find((file) => file.file_type === "artwork") || {};
  if (!artworkFile.file_path && !release?.artwork_file_path && !release?.artwork_url) {
    addIssue(artwork, "error", "Artwork is missing.", 16);
  } else {
    const dimensions = readImageDimensions(artworkFile.file_path || release?.artwork_file_path || release?.artwork_url);
    if (!dimensions) {
      addIssue(artwork, "warning", "Artwork dimensions could not be verified from the stored file.", 7);
    } else {
      if (dimensions.width !== dimensions.height) addIssue(artwork, "error", "Artwork must be square.", 15);
      if (dimensions.width < 3000 || dimensions.height < 3000) {
        addIssue(artwork, "warning", `Artwork is ${dimensions.width}x${dimensions.height}; 3000x3000 is recommended.`, 6);
      }
      addPass(artwork, `Artwork dimensions verified at ${dimensions.width}x${dimensions.height}.`);
    }
    if (artworkFile.mime_type && !["image/jpeg", "image/png", "image/webp"].includes(artworkFile.mime_type)) {
      addIssue(artwork, "error", "Artwork must be JPG, PNG, or WebP.", 14);
    }
  }

  if (!normalizeText(release?.copyright_holder || release?.copyright_owner)) addIssue(rights, "error", "Copyright owner/holder is missing.", 14);
  if (!normalizeText(release?.copyright_line)) addIssue(rights, "warning", "Copyright line is missing.", 5);
  if (!normalizeText(release?.publisher)) addIssue(rights, "warning", "Publisher is missing.", 4);
  if (!normalizeText(release?.current_owner || release?.created_by || release?.user_id)) {
    addIssue(rights, "warning", "Current catalog owner is not resolved.", 6);
  }

  const targetPlatforms = getReleasePlatforms(release, tracks);
  const deliveryByPlatform = new Map(deliveries.map((item) => [normalizeText(item.platform).toLowerCase(), item]));
  const missingPlatforms = targetPlatforms.filter((platform) => !deliveryByPlatform.has(platform.toLowerCase()));
  const failedPlatforms = deliveries.filter((item) => ["failed", "rejected"].includes(normalizeText(item.delivery_status).toLowerCase()));
  if (missingPlatforms.length) addIssue(delivery, "warning", `Missing delivery queue/status for ${missingPlatforms.slice(0, 5).join(", ")}.`, 6);
  failedPlatforms.forEach((item) => addIssue(delivery, "error", `${item.platform} delivery is ${item.delivery_status}.`, 12));
  deliveries.forEach((item) => {
    if (item.platform_url && !/^https?:\/\//i.test(item.platform_url)) {
      addIssue(delivery, "warning", `${item.platform} URL should start with http or https.`, 4);
    }
  });
  if (!deliveries.length) addIssue(delivery, "warning", "No DSP delivery records exist yet.", 6);

  const trackReports = tracks.map((track, index) => buildTrackQcReport(track, index, release));
  trackReports.forEach((report) => {
    report.errors.forEach((message) => addIssue(audio, "error", message, 8));
    report.warnings.forEach((message) => addIssue(audio, "warning", message, 3));
  });

  const conflicts = await detectCatalogConflicts(client, { release, tracks, files });
  conflicts.forEach((conflict) => {
    addIssue(
      metadata,
      conflict.severity === "error" ? "error" : "warning",
      conflict.message,
      conflict.severity === "error" ? 12 : 5
    );
  });

  const metadataCompletion = calculateReleaseCompletion(release, tracks);
  const categories = { metadata, artwork, audio, rights, delivery };
  const warnings = Object.values(categories).flatMap((category) => category.warnings);
  const errors = Object.values(categories).flatMap((category) => category.errors);
  const categoryAverage = Math.round(
    Object.values(categories).reduce((sum, category) => sum + category.score, 0) / Object.keys(categories).length
  );
  const qcScore = Math.max(0, Math.min(100, Math.round(categoryAverage * 0.68 + metadataCompletion * 0.32)));
  const releaseHealth = Math.max(
    0,
    Math.min(
      100,
      Math.round(qcScore * 0.46 + metadataCompletion * 0.22 + delivery.score * 0.14 + rights.score * 0.1 + artwork.score * 0.08)
    )
  );
  const suggestions = [
    ...buildMetadataSuggestions(release, tracks),
    ...warnings.slice(0, 8).map((message) => `Review: ${message}`),
  ].filter(Boolean);

  return {
    qcScore,
    metadataCompletion,
    releaseHealth,
    status: errors.length ? "failed" : warnings.length ? "warning" : "passed",
    categories,
    warnings,
    errors,
    suggestions: [...new Set(suggestions)],
    conflicts,
    trackReports,
    targetPlatforms,
  };
};

module.exports = {
  knownPlatforms,
  runAdvancedQc,
  slugify,
};
