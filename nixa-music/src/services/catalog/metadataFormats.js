const defaultMetadataFormats = {
  default_format: "auto",
  formats: {
    v1: {
      key: "v1",
      label: "Metadata V1",
      enabled: true,
      required_fields: ["release_title", "track_title", "primary_artist", "label_name", "genre", "language"],
      optional_fields: [
        "version",
        "featuring_artist",
        "sub_label_name",
        "upc",
        "isrc",
        "subgenre",
        "mood",
        "explicit",
        "composer",
        "lyricist",
        "producer",
        "publisher",
        "release_date",
        "original_release_date",
        "go_live_date",
        "preview_start_time",
        "copyright_line",
        "metadata_notes",
        "contributors",
        "territory",
        "crbt_title",
        "crbt_start_time_1",
      ],
    },
    v2: {
      key: "v2",
      label: "Metadata V2",
      enabled: true,
      required_fields: ["release_title", "track_title", "primary_artist", "label_name", "genre", "language"],
      optional_fields: [
        "version",
        "featuring_artist",
        "remixer",
        "sub_label_name",
        "upc",
        "isrc",
        "iswc",
        "subgenre",
        "mood",
        "description",
        "explicit",
        "instrumental",
        "composer",
        "lyricist",
        "producer",
        "director",
        "star_cast",
        "publisher",
        "release_date",
        "original_release_date",
        "go_live_date",
        "preview_start_time",
        "copyright_line",
        "metadata_notes",
        "contributors",
        "territory",
        "crbt_title",
        "crbt_start_time_1",
      ],
    },
  },
  aliases: {},
};

const canonicalFields = [
  "release_type",
  "release_title",
  "track_title",
  "version",
  "primary_artist",
  "featuring_artist",
  "remixer",
  "label_name",
  "sub_label_name",
  "upc",
  "isrc",
  "iswc",
  "genre",
  "subgenre",
  "mood",
  "language",
  "explicit",
  "instrumental",
  "composer",
  "lyricist",
  "producer",
  "director",
  "star_cast",
  "publisher",
  "release_date",
  "original_release_date",
  "go_live_date",
  "platforms",
  "artwork",
  "audio",
  "preview_start_time",
  "copyright_holder",
  "copyright_line",
  "metadata_notes",
  "contributors",
  "territory",
  "crbt_title",
  "crbt_start_time_1",
  "crbt_start_time_2",
  "description",
  "duration",
  "track_number",
  "catalog_number",
  "dolby_atmos",
];

const baseAliases = {
  release_type: ["Release Type", "Album Type", "ALBUM CATEGORY"],
  release_title: ["Release Title", "Film /Album Name", "FILM/ALBUM", "Film/Album", "Album", "Album Name", "album_name"],
  track_title: ["Track Title", "Song Name", "SONG", "Song", "song_name"],
  version: ["Version"],
  primary_artist: ["Primary Artist", "Album Level Main Artist/singer", "Track Level Main Artist/singer", "ARTIST1/ Singer", "ArtistName"],
  featuring_artist: ["Featuring", "Track Level Featuring Artist/Singer", "Featured Artists"],
  remixer: ["Remixer", "Track Level Remixer Name"],
  label_name: ["Label", "LABEL", "Label Name", "L1_name"],
  sub_label_name: ["Sub Label", "Sub Label Name", "L2_name"],
  upc: ["UPC", "UPC ID"],
  isrc: ["ISRC"],
  iswc: ["ISWC"],
  genre: ["Genre", "GENRE/ Category", "Genre/ Category"],
  subgenre: ["Subgenre", "Sub-Genre", "Sub Genre", "Sub Category"],
  mood: ["Mood"],
  language: ["Language", "LANGUAGE"],
  explicit: ["Explicit", "Parental Advisory", "Parental Advisory (Explicit etc)"],
  instrumental: ["Instrumental", "IS INSTRUMENTAL"],
  composer: ["Composer", "Composer Name", "COMPOSER"],
  lyricist: ["Lyricist", "Lyricist Name", "LYRICIST"],
  producer: ["Producer", "Film Producer", "Music Director"],
  director: ["Director", "Film Director"],
  star_cast: ["Star cast", "Star Cast", "Film Star Cast / Actors"],
  publisher: ["Publisher", "Publisher Name"],
  release_date: ["Release Date", "Date of Release", "DATE OF MUSIC RELEASE"],
  original_release_date: ["Original Release Date", "Original Release Date <dd-mm-yyyy>", "DATE OF MOVIE RELEASE"],
  go_live_date: ["Go Live Date", "Go Live Date <dd-mm-yyyy>", "GO LIVE DATE"],
  platforms: ["Platforms", "Stores", "Store Selection"],
  artwork: ["Artwork", "Physical artwork name"],
  audio: ["Audio", "Physical File name"],
  preview_start_time: ["Preview Start", "preview_start_time", "Time"],
  copyright_holder: ["Copyright Holder", "SOUND RECORDING RIGHTS"],
  copyright_line: ["Copyright Line", "C-Line", "MUSICAL & LITERARY WORKS"],
  metadata_notes: ["Metadata Notes", "Description"],
  contributors: ["Contributors"],
  territory: ["Territory", "Territories"],
  crbt_title: ["CRBT CUT NAME", "CRBT CUTS"],
  crbt_start_time_1: ["Time for CRBT Cut", "Time"],
  crbt_start_time_2: ["CRBT Start 2"],
  description: ["Description"],
  duration: ["Duration", "Track Duration"],
  track_number: ["Track No.", "Track no."],
  catalog_number: ["Catalog Number"],
  dolby_atmos: ["Dolby", "Dolby ISRC"],
};

const templateHeaders = {
  v1: {
    release_title: "FILM/ALBUM",
    track_title: "SONG",
    release_type: "ALBUM CATEGORY",
    language: "LANGUAGE",
    genre: "GENRE/ Category",
    subgenre: "Sub Category",
    description: "Description",
    audio: "Physical File name",
    artwork: "Physical artwork name",
    duration: "Track Duration",
    track_number: "Track no.",
    upc: "UPC ID",
    original_release_date: "DATE OF MOVIE RELEASE",
    release_date: "DATE OF MUSIC RELEASE",
    go_live_date: "GO LIVE DATE",
    director: "Director",
    producer: "Producer",
    star_cast: "Star cast",
    isrc: "ISRC",
    label_name: "LABEL",
    publisher: "Publisher",
    lyricist: "LYRICIST",
    composer: "COMPOSER",
    primary_artist: "ARTIST1/ Singer",
    copyright_holder: "SOUND RECORDING RIGHTS",
    copyright_line: "MUSICAL & LITERARY WORKS",
    mood: "Mood",
    crbt_start_time_1: "Time",
    crbt_title: "CRBT CUTS",
  },
  v2: {
    track_title: "Song Name",
    release_title: "Film /Album Name",
    language: "Language",
    release_type: "Album Type",
    version: "Version",
    genre: "Genre",
    subgenre: "Sub-Genre",
    mood: "Mood",
    description: "Description",
    upc: "UPC ID",
    isrc: "ISRC",
    label_name: "Label Name",
    publisher: "Publisher Name",
    copyright_line: "C-Line",
    primary_artist: "Track Level Main Artist/singer",
    featuring_artist: "Track Level Featuring Artist/Singer",
    remixer: "Track Level Remixer Name",
    composer: "Composer Name",
    lyricist: "Lyricist Name",
    producer: "Film Producer",
    director: "Film Director",
    star_cast: "Film Star Cast / Actors",
    track_number: "Track No.",
    original_release_date: "Original Release Date <dd-mm-yyyy>",
    go_live_date: "Go Live Date <dd-mm-yyyy>",
    explicit: "Parental Advisory (Explicit etc)",
    instrumental: "IS INSTRUMENTAL",
    crbt_title: "CRBT CUT NAME",
    crbt_start_time_1: "Time for CRBT Cut",
  },
};

const normalizeKey = (key) =>
  String(key || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w/<> -]+/g, "");

const buildRowIndex = (row) => {
  const index = new Map();
  Object.entries(row || {}).forEach(([key, value]) => {
    index.set(normalizeKey(key), value);
  });
  return index;
};

const getValue = (row, aliases = []) => {
  const index = buildRowIndex(row);
  for (const alias of aliases) {
    const value = index.get(normalizeKey(alias));
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
};

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const mmddyy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mmddyy) {
    const [, month, day, year] = mmddyy;
    return `20${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const ddmmyyyy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
};

const parseBoolean = (value) => {
  const text = String(value || "").trim().toLowerCase();
  return ["true", "yes", "y", "1", "explicit"].includes(text);
};

const normalizeIsrc = (value) => {
  const text = String(value || "").trim().toUpperCase().replace(/-/g, "");
  return text || null;
};

const detectMetadataFormat = (rows = [], requestedFormat = "auto", settings = defaultMetadataFormats) => {
  const enabled = settings.formats || defaultMetadataFormats.formats;
  const requested = String(requestedFormat || settings.default_format || "auto").toLowerCase();
  if (requested !== "auto" && enabled[requested]?.enabled !== false) {
    return requested;
  }

  const headers = Object.keys(rows.find((row) => Object.keys(row || {}).length) || {}).map(normalizeKey);
  const hasV2 = headers.some((header) =>
    ["track level main artist/singer", "album level main artist/singer", "go live date <dd-mm-yyyy>", "is label iprs member yes/no"].includes(header)
  );
  const hasV1 = headers.some((header) =>
    ["crbt cuts", "film/album", "genre/ category", "physical file name"].includes(header)
  );

  if (hasV2 && enabled.v2?.enabled !== false) return "v2";
  if (hasV1 && enabled.v1?.enabled !== false) return "v1";
  if (enabled[settings.default_format]?.enabled !== false && settings.default_format !== "auto") return settings.default_format;
  return enabled.v2?.enabled !== false ? "v2" : "v1";
};

const mapMetadataRow = (row, format = "v2", settings = defaultMetadataFormats) => {
  const customAliases = settings.aliases || {};
  const aliases = Object.fromEntries(
    canonicalFields.map((field) => [field, [...(baseAliases[field] || []), ...(customAliases[field] || [])]])
  );

  const normalized = {};
  canonicalFields.forEach((field) => {
    const value = getValue(row, aliases[field]);
    if (value !== null) normalized[field] = value;
  });

  normalized.release_title = normalized.release_title || normalized.track_title;
  normalized.track_title = normalized.track_title || normalized.release_title;
  normalized.label_name = normalized.label_name || normalized.sub_label_name;
  normalized.primary_artist = normalized.primary_artist || "";
  const releaseTypeSource = `${normalized.release_type || ""} ${normalized.version || ""}`.toLowerCase();
  normalized.release_type = releaseTypeSource.includes("album")
    ? "album"
    : releaseTypeSource.includes("ep")
      ? "ep"
      : "single";
  normalized.isrc = normalizeIsrc(normalized.isrc);
  normalized.upc = normalized.upc ? String(normalized.upc).replace(/\.0$/, "").trim() : null;
  normalized.release_date = parseDateValue(normalized.release_date || normalized.go_live_date || normalized.original_release_date);
  normalized.original_release_date = parseDateValue(normalized.original_release_date || normalized.release_date);
  normalized.go_live_date = parseDateValue(normalized.go_live_date || normalized.release_date);
  normalized.explicit = parseBoolean(normalized.explicit);
  normalized.instrumental = parseBoolean(normalized.instrumental);
  normalized.dolby_atmos = parseBoolean(normalized.dolby_atmos);
  normalized.platforms = normalized.platforms
    ? String(normalized.platforms).split(",").map((item) => item.trim()).filter(Boolean)
    : [];
  normalized.metadata_format_version = format;

  return {
    raw: row,
    normalized,
  };
};

const validateMetadataRow = ({ normalized, raw }, format = "v2", settings = defaultMetadataFormats, context = {}) => {
  const formatConfig = settings.formats?.[format] || defaultMetadataFormats.formats[format] || defaultMetadataFormats.formats.v2;
  const requiredFields = formatConfig.required_fields || [];
  const errors = [];
  const warnings = [];

  requiredFields.forEach((field) => {
    if (normalized[field] === undefined || normalized[field] === null || String(normalized[field]).trim() === "") {
      errors.push(`Missing required field: ${field}.`);
    }
  });

  if (normalized.isrc && !/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(normalized.isrc)) {
    errors.push("Invalid ISRC format.");
  }

  if (normalized.upc && !/^[0-9]{12,14}$/.test(String(normalized.upc))) {
    warnings.push("UPC should be 12 to 14 digits.");
  }

  ["release_date", "original_release_date", "go_live_date"].forEach((field) => {
    if (normalized[field] && Number.isNaN(new Date(normalized[field]).getTime())) {
      errors.push(`Invalid date: ${field}.`);
    }
  });

  if (context.seenIsrcs?.has(normalized.isrc)) {
    errors.push("Duplicate ISRC inside uploaded file.");
  }
  if (normalized.isrc) {
    context.seenIsrcs?.add(normalized.isrc);
  }

  if (context.seenUpcs?.has(normalized.upc)) {
    warnings.push("Duplicate UPC inside uploaded file.");
  }
  if (normalized.upc) {
    context.seenUpcs?.add(normalized.upc);
  }

  const unknownHeaders = Object.keys(raw || {}).filter((header) => String(header).trim() && !Object.values(baseAliases).flat().some((alias) => normalizeKey(alias) === normalizeKey(header)));

  return {
    errors,
    warnings,
    unknownHeaders,
  };
};

const buildTemplateRows = (format = "v2", settings = defaultMetadataFormats) => {
  const activeFormat = settings.formats?.[format] || defaultMetadataFormats.formats[format] || defaultMetadataFormats.formats.v2;
  const fields = [...new Set([...(activeFormat.required_fields || []), ...(activeFormat.optional_fields || [])])];
  const row = {};

  fields.forEach((field) => {
    const header = templateHeaders[format]?.[field] || (baseAliases[field] || [field])[0];
    row[header] = "";
  });

  row[templateHeaders[format]?.release_title || "Release Title"] = "Example Release";
  row[templateHeaders[format]?.track_title || "Song Name"] = "Example Song";
  row[templateHeaders[format]?.primary_artist || "Primary Artist"] = "Artist Name";
  row[templateHeaders[format]?.label_name || "Label"] = "Nixa Music";
  row[templateHeaders[format]?.genre || "Genre"] = "Pop";
  row[templateHeaders[format]?.language || "Language"] = "Hindi";
  row[templateHeaders[format]?.release_date || templateHeaders[format]?.go_live_date || "Release Date"] = "2026-06-01";
  row[templateHeaders[format]?.isrc || "ISRC"] = "INN892600001";

  return [row];
};

module.exports = {
  baseAliases,
  buildTemplateRows,
  canonicalFields,
  defaultMetadataFormats,
  detectMetadataFormat,
  mapMetadataRow,
  normalizeKey,
  parseDateValue,
  validateMetadataRow,
};
