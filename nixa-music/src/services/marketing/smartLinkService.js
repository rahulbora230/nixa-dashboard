const crypto = require("crypto");
const pool = require("../../config/db");
const { ensureMarketingSchema } = require("./marketingSchema");

const platformOrder = [
  "Spotify",
  "Apple Music",
  "YouTube",
  "JioSaavn",
  "Wynk",
  "Amazon Music",
  "Gaana",
  "Boomplay",
];

const platformAliases = new Map([
  ["spotify", "Spotify"],
  ["apple", "Apple Music"],
  ["apple music", "Apple Music"],
  ["youtube", "YouTube"],
  ["youtube music", "YouTube"],
  ["jiosaavn", "JioSaavn"],
  ["saavn", "JioSaavn"],
  ["wynk", "Wynk"],
  ["amazon", "Amazon Music"],
  ["amazon music", "Amazon Music"],
  ["gaana", "Gaana"],
  ["boomplay", "Boomplay"],
]);

const allowedSmartLinkStatuses = new Set(["active", "inactive", "draft", "archived", "pre_save"]);
const allowedCampaignStatuses = new Set(["active", "inactive", "draft", "archived"]);

const normalizeText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const normalizeStatus = (value, fallback = "active") => {
  const normalized = normalizeText(value)?.toLowerCase() || fallback;
  return allowedSmartLinkStatuses.has(normalized) ? normalized : fallback;
};

const normalizeCampaignStatus = (value, fallback = "inactive") => {
  const normalized = normalizeText(value)?.toLowerCase() || fallback;
  return allowedCampaignStatuses.has(normalized) ? normalized : fallback;
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);

const slugify = (value) => {
  const base = normalizeText(value) || "nixa-link";
  const slug = base
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return slug || "nixa-link";
};

const canonicalPlatform = (platform) => {
  const clean = normalizeText(platform);
  if (!clean) {
    return null;
  }

  return platformAliases.get(clean.toLowerCase()) || clean;
};

const platformRank = (platform) => {
  const rank = platformOrder.findIndex((item) => item.toLowerCase() === String(platform || "").toLowerCase());
  return rank === -1 ? platformOrder.length + 1 : rank + 1;
};

const getPublicOrigin = () =>
  (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(
    /\/+$/,
    ""
  );

const getSmartLinkUrl = (slug) => `${getPublicOrigin()}/s/${slug}`;
const getPublicReleaseUrl = (releaseSlug, trackSlug) =>
  `${getPublicOrigin()}/release/${releaseSlug}${trackSlug ? `/${trackSlug}` : ""}`;
const getPublicArtistUrl = (artistSlug) => `${getPublicOrigin()}/artist/${artistSlug}`;

const validateUrl = (url) => {
  const value = normalizeText(url);
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const getRequestIpHash = (req) => {
  const forwarded = normalizeText(req.headers?.["x-forwarded-for"]);
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    normalizeText(req.headers?.["x-real-ip"]) ||
    normalizeText(req.ip) ||
    normalizeText(req.socket?.remoteAddress) ||
    "unknown";
  const salt = process.env.IP_HASH_SALT || process.env.JWT_SECRET || "nixa-music";

  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
};

const getRequestGeo = (req, body = {}) => ({
  country:
    normalizeText(body.country) ||
    normalizeText(req.headers?.["cf-ipcountry"]) ||
    normalizeText(req.headers?.["x-vercel-ip-country"]) ||
    null,
  city:
    normalizeText(body.city) ||
    normalizeText(req.headers?.["x-vercel-ip-city"]) ||
    normalizeText(req.headers?.["x-city"]) ||
    null,
});

const formatReleaseRow = (row = {}) => ({
  id: row.release_id || row.id,
  title: row.release_title || row.title || row.album_name || "Untitled release",
  slug: row.release_slug || row.permalink_slug || slugify(row.release_title || row.title || row.album_name),
  artist: row.primary_artist || row.artist_name || "Unknown artist",
  label: row.label_name || row.label_display_name || null,
  release_date: row.release_date,
  go_live_date: row.go_live_date,
  upc: row.upc,
  artwork_url: row.artwork_url || row.artwork_file_path || null,
  status: row.release_status || row.status,
  public_url: getPublicReleaseUrl(row.release_slug || row.permalink_slug || slugify(row.release_title || row.title)),
});

const formatTrackRow = (row = {}) => ({
  id: row.track_id || row.id,
  title: row.track_title || row.song_name || row.title || "Untitled track",
  slug: row.track_slug || slugify(row.track_title || row.song_name || row.title || row.isrc),
  isrc: row.isrc,
  artist: row.track_artist || row.primary_artist || null,
});

const formatSmartLink = (row, platforms = []) => {
  if (!row) {
    return null;
  }

  const releaseSlug = row.release_slug || row.permalink_slug || slugify(row.release_title || row.release_name);
  const trackSlug = row.track_slug || (row.track_title ? slugify(row.track_title) : null);

  return {
    id: row.id,
    release_id: row.release_id,
    track_id: row.track_id,
    slug: row.slug,
    title: row.title || row.track_title || row.release_title || "Nixa smart link",
    description: row.description,
    artwork_url: row.artwork_url,
    status: row.status,
    created_by: row.created_by,
    click_count: Number(row.click_count || row.tracked_clicks || 0),
    platform_count: Number(row.platform_count || platforms.length || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    public_url: getSmartLinkUrl(row.slug),
    public_release_url: getPublicReleaseUrl(releaseSlug, trackSlug),
    release: {
      id: row.release_id,
      title: row.release_title || row.release_name || null,
      slug: releaseSlug,
      artist: row.primary_artist || row.artist_name || null,
      label: row.label_name || row.label_display_name || null,
      release_date: row.release_date,
      upc: row.upc,
      artwork_url: row.release_artwork_url || row.artwork_url || row.artwork_file_path || null,
    },
    track: row.track_id
      ? {
          id: row.track_id,
          title: row.track_title || null,
          slug: trackSlug,
          isrc: row.isrc || null,
        }
      : null,
    platforms,
  };
};

const getReleaseAccessCondition = (user, values, alias = "r", mode = "read") => {
  if (!user?.role) {
    return "FALSE";
  }

  if (user.role === "admin" || (mode === "read" && user.role === "accountant")) {
    return "";
  }

  if (mode === "manage" && user.role === "accountant") {
    return "FALSE";
  }

  if (!["artist", "label"].includes(user.role)) {
    return "FALSE";
  }

  values.push(String(user.id));
  const userIndex = values.length;

  const ownershipChecks = [
    `${alias}.created_by = $${userIndex}`,
    `${alias}.owner_id::text = $${userIndex}`,
  ];

  if (user.role === "artist") {
    ownershipChecks.push(`
      EXISTS (
        SELECT 1
        FROM artists a
        WHERE a.user_id::text = $${userIndex}
          AND (
            ${alias}.artist_id = a.id
            OR LOWER(${alias}.primary_artist) = LOWER(a.artist_name)
          )
      )
    `);
    ownershipChecks.push(`
      EXISTS (
        SELECT 1
        FROM tracks access_track
        WHERE access_track.release_id = ${alias}.id
          AND access_track.owner_id::text = $${userIndex}
      )
    `);
  }

  if (user.role === "label") {
    ownershipChecks.push(`
      EXISTS (
        SELECT 1
        FROM labels l
        WHERE l.user_id::text = $${userIndex}
          AND (
            LOWER(${alias}.label_name) = LOWER(COALESCE(l.label_name, l.name))
            OR ${alias}.owner_id = l.id
          )
      )
    `);
    ownershipChecks.push(`
      EXISTS (
        SELECT 1
        FROM labels l
        JOIN artist_label_map alm ON alm.label_id = l.id AND COALESCE(alm.status, 'active') = 'active'
        LEFT JOIN artists a ON a.id = alm.artist_id
        WHERE l.user_id::text = $${userIndex}
          AND (
            ${alias}.artist_id = alm.artist_id
            OR LOWER(${alias}.primary_artist) = LOWER(a.artist_name)
          )
      )
    `);
  }

  return `(${ownershipChecks.join(" OR ")})`;
};

const getReleaseContext = async (releaseId, trackId = null, client = pool) => {
  const releaseResult = await client.query(
    `
    SELECT
      r.*,
      r.id AS release_id,
      COALESCE(r.release_title, r.title, r.album_name) AS release_title,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(r.permalink_slug, r.release_title, r.title, r.album_name, r.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) AS release_slug,
      COALESCE(l.label_name, l.name, r.label_name) AS label_display_name,
      af.file_path AS artwork_file_path,
      COALESCE(r.artwork_url, af.file_path, af.file_url) AS artwork_url
    FROM releases r
    LEFT JOIN labels l ON l.id::text = r.owner_id::text
    LEFT JOIN LATERAL (
      SELECT file_path, file_url
      FROM release_files
      WHERE release_id = r.id AND file_type = 'artwork'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) af ON true
    WHERE r.id = $1
    LIMIT 1
    `,
    [releaseId]
  );

  const release = releaseResult.rows[0];
  if (!release) {
    return null;
  }

  const tracksResult = await client.query(
    `
    SELECT
      t.*,
      t.id AS track_id,
      COALESCE(t.title, t.song_name) AS track_title,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(t.title, t.song_name, t.isrc, t.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) AS track_slug
    FROM tracks t
    WHERE t.release_id = $1
    ORDER BY t.created_at ASC, t.id ASC
    `,
    [releaseId]
  );

  const tracks = tracksResult.rows;
  const track = trackId ? tracks.find((item) => String(item.id) === String(trackId)) : null;
  if (trackId && !track) {
    return null;
  }

  return { release, tracks, track };
};

const assertReleaseAccess = async (user, releaseId, mode = "read") => {
  const values = [releaseId];
  const accessCondition = getReleaseAccessCondition(user, values, "r", mode);
  const where = accessCondition ? `AND ${accessCondition}` : "";
  const result = await pool.query(`SELECT r.id FROM releases r WHERE r.id = $1 ${where} LIMIT 1`, values);

  return result.rows.length > 0;
};

const assertSmartLinkAccess = async (user, smartLinkId, mode = "read") => {
  const values = [smartLinkId];
  const accessCondition = getReleaseAccessCondition(user, values, "r", mode);
  const where = accessCondition ? `AND ${accessCondition}` : "";
  const result = await pool.query(
    `
    SELECT sl.id, sl.release_id, sl.track_id
    FROM smart_links sl
    LEFT JOIN releases r ON r.id = sl.release_id
    WHERE sl.id = $1 ${where}
    LIMIT 1
    `,
    values
  );

  return result.rows[0] || null;
};

const ensureUniqueSlug = async (baseSlug, client = pool, excludeId = null, table = "smart_links") => {
  const cleanBase = slugify(baseSlug);

  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? cleanBase : `${cleanBase}-${index + 1}`;
    const params = [candidate];
    let excludeClause = "";

    if (excludeId) {
      params.push(excludeId);
      excludeClause = `AND id <> $${params.length}`;
    }

    const result = await client.query(
      `SELECT id FROM ${table} WHERE LOWER(slug) = LOWER($1) ${excludeClause} LIMIT 1`,
      params
    );

    if (!result.rows.length) {
      return candidate;
    }
  }

  return `${cleanBase}-${Date.now()}`;
};

const getPlatformsForSmartLink = async (smartLinkId, activeOnly = false, client = pool) => {
  const result = await client.query(
    `
    SELECT *
    FROM smart_link_platforms
    WHERE smart_link_id = $1
      ${activeOnly ? "AND is_active = true" : ""}
    ORDER BY display_order ASC, platform ASC
    `,
    [smartLinkId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    smart_link_id: row.smart_link_id,
    platform: row.platform,
    url: row.url,
    button_text: row.button_text || `Listen on ${row.platform}`,
    display_order: Number(row.display_order || 0),
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
};

const getDefaultPlatformLinks = async (releaseId, trackId = null, client = pool) => {
  const result = await client.query(
    `
    SELECT platform, url, platform_track_id
    FROM (
      SELECT tpl.platform, tpl.platform_url AS url, tpl.platform_track_id
      FROM track_platform_links tpl
      WHERE tpl.release_id = $1
        AND tpl.platform_url IS NOT NULL
        AND ($2::uuid IS NULL OR tpl.track_id = $2::uuid)
      UNION ALL
      SELECT rd.platform, rd.platform_url AS url, rd.platform_track_id
      FROM release_deliveries rd
      WHERE rd.release_id = $1
        AND rd.platform_url IS NOT NULL
        AND rd.delivery_status IN ('delivered', 'live', 'updated', 'processing', 'pending')
        AND ($2::uuid IS NULL OR rd.track_id = $2::uuid OR rd.track_id IS NULL)
    ) links
    ORDER BY platform ASC
    `,
    [releaseId, trackId]
  );

  const byPlatform = new Map();

  for (const row of result.rows) {
    const platform = canonicalPlatform(row.platform);
    const url = validateUrl(row.url);
    if (!platform || !url || byPlatform.has(platform.toLowerCase())) {
      continue;
    }
    byPlatform.set(platform.toLowerCase(), {
      platform,
      url,
      button_text: `Listen on ${platform}`,
      display_order: platformRank(platform),
      is_active: true,
    });
  }

  return Array.from(byPlatform.values()).sort((a, b) => a.display_order - b.display_order);
};

const normalizePlatformPayloads = (platforms = []) => {
  if (!Array.isArray(platforms)) {
    return [];
  }

  return platforms
    .map((platform, index) => {
      const name = canonicalPlatform(platform.platform || platform.name);
      const url = validateUrl(platform.url || platform.platform_url);
      if (!name || !url) {
        return null;
      }

      return {
        platform: name,
        url,
        button_text: normalizeText(platform.button_text) || `Listen on ${name}`,
        display_order: Number.isFinite(Number(platform.display_order))
          ? Number(platform.display_order)
          : platformRank(name) || index + 1,
        is_active: platform.is_active !== false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.display_order - b.display_order);
};

const insertPlatforms = async (client, smartLinkId, platforms = []) => {
  for (const [index, platform] of platforms.entries()) {
    await client.query(
      `
      INSERT INTO smart_link_platforms (
        smart_link_id, platform, url, button_text, display_order, is_active, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (smart_link_id, LOWER(platform))
      DO UPDATE SET
        url = EXCLUDED.url,
        button_text = EXCLUDED.button_text,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      `,
      [
        smartLinkId,
        platform.platform,
        platform.url,
        platform.button_text,
        Number.isFinite(Number(platform.display_order)) ? Number(platform.display_order) : index + 1,
        platform.is_active !== false,
      ]
    );
  }
};

const getSmartLinkRow = async (field, value, client = pool) => {
  const column = field === "slug" ? "LOWER(sl.slug) = LOWER($1)" : "sl.id = $1";
  const result = await client.query(
    `
    SELECT
      sl.*,
      COALESCE(r.release_title, r.title, r.album_name) AS release_title,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(r.permalink_slug, r.release_title, r.title, r.album_name, r.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) AS release_slug,
      r.primary_artist,
      r.label_name,
      r.release_date,
      r.upc,
      COALESCE(r.artwork_url, af.file_path, af.file_url) AS release_artwork_url,
      COALESCE(t.title, t.song_name) AS track_title,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(t.title, t.song_name, t.isrc, t.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) AS track_slug,
      t.isrc
    FROM smart_links sl
    LEFT JOIN releases r ON r.id = sl.release_id
    LEFT JOIN tracks t ON t.id = sl.track_id
    LEFT JOIN LATERAL (
      SELECT file_path, file_url
      FROM release_files
      WHERE release_id = r.id AND file_type = 'artwork'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) af ON true
    WHERE ${column}
    LIMIT 1
    `,
    [value]
  );

  return result.rows[0] || null;
};

const listSmartLinks = async (user, query = {}) => {
  await ensureMarketingSchema();

  const values = [];
  const conditions = ["COALESCE(sl.status, 'active') <> 'archived'"];
  const accessCondition = getReleaseAccessCondition(user, values, "r", "read");

  if (accessCondition) {
    conditions.push(accessCondition);
  }

  if (query.search) {
    values.push(`%${String(query.search).trim()}%`);
    const index = values.length;
    conditions.push(`
      (
        sl.title ILIKE $${index}
        OR sl.slug ILIKE $${index}
        OR r.release_title ILIKE $${index}
        OR r.title ILIKE $${index}
        OR r.primary_artist ILIKE $${index}
        OR t.title ILIKE $${index}
        OR t.song_name ILIKE $${index}
      )
    `);
  }

  if (query.status) {
    values.push(String(query.status).toLowerCase());
    conditions.push("LOWER(sl.status) = $" + values.length);
  }

  if (query.releaseId) {
    values.push(query.releaseId);
    conditions.push("sl.release_id = $" + values.length);
  }

  if (query.trackId) {
    values.push(query.trackId);
    conditions.push("sl.track_id = $" + values.length);
  }

  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query(
    `
    SELECT COUNT(DISTINCT sl.id)::int AS total
    FROM smart_links sl
    LEFT JOIN releases r ON r.id = sl.release_id
    LEFT JOIN tracks t ON t.id = sl.track_id
    ${where}
    `,
    values
  );

  const listValues = [...values, limit, offset];
  const result = await pool.query(
    `
    SELECT
      sl.*,
      COALESCE(r.release_title, r.title, r.album_name) AS release_title,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(r.permalink_slug, r.release_title, r.title, r.album_name, r.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) AS release_slug,
      r.primary_artist,
      r.label_name,
      r.release_date,
      r.upc,
      COALESCE(r.artwork_url, af.file_path, af.file_url) AS release_artwork_url,
      COALESCE(t.title, t.song_name) AS track_title,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(t.title, t.song_name, t.isrc, t.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) AS track_slug,
      t.isrc,
      COUNT(DISTINCT slc.id)::int AS tracked_clicks,
      COUNT(DISTINCT slp.id)::int AS platform_count
    FROM smart_links sl
    LEFT JOIN releases r ON r.id = sl.release_id
    LEFT JOIN tracks t ON t.id = sl.track_id
    LEFT JOIN smart_link_clicks slc ON slc.smart_link_id = sl.id
    LEFT JOIN smart_link_platforms slp ON slp.smart_link_id = sl.id
    LEFT JOIN LATERAL (
      SELECT file_path, file_url
      FROM release_files
      WHERE release_id = r.id AND file_type = 'artwork'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) af ON true
    ${where}
    GROUP BY sl.id, r.id, t.id, af.file_path, af.file_url
    ORDER BY sl.updated_at DESC, sl.created_at DESC
    LIMIT $${listValues.length - 1} OFFSET $${listValues.length}
    `,
    listValues
  );

  return {
    smartLinks: result.rows.map((row) => formatSmartLink(row)),
    pagination: {
      page,
      limit,
      total: countResult.rows[0]?.total || 0,
      pages: Math.ceil((countResult.rows[0]?.total || 0) / limit),
    },
  };
};

const createSmartLink = async (user, payload = {}) => {
  await ensureMarketingSchema();

  if (!["admin", "artist", "label"].includes(user?.role)) {
    const error = new Error("You do not have permission to create smart links.");
    error.status = 403;
    throw error;
  }

  const releaseId = normalizeText(payload.release_id || payload.releaseId);
  const trackId = normalizeText(payload.track_id || payload.trackId);

  if (!releaseId) {
    const error = new Error("Release is required.");
    error.status = 400;
    throw error;
  }

  if (!(await assertReleaseAccess(user, releaseId, "manage"))) {
    const error = new Error("You do not have access to manage this release.");
    error.status = 403;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const context = await getReleaseContext(releaseId, trackId, client);

    if (!context) {
      const error = new Error("Release or track not found.");
      error.status = 404;
      throw error;
    }

    const releaseTitle = context.release.release_title || context.release.title || context.release.album_name;
    const trackTitle = context.track?.track_title;
    const artist = context.release.primary_artist || context.track?.primary_artist;
    const smartTitle = normalizeText(payload.title) || trackTitle || releaseTitle;
    const baseSlug = normalizeText(payload.slug) || `${artist || "nixa"} ${smartTitle || releaseTitle}`;
    const slug = await ensureUniqueSlug(baseSlug, client);
    const artworkUrl = normalizeText(payload.artwork_url || payload.artworkUrl) || context.release.artwork_url;
    const status = normalizeStatus(payload.status, "active");

    const insertResult = await client.query(
      `
      INSERT INTO smart_links (
        release_id, track_id, slug, title, description, artwork_url, status, created_by, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
      `,
      [
        context.release.id,
        context.track?.id || null,
        slug,
        smartTitle,
        normalizeText(payload.description),
        artworkUrl,
        status,
        isUuid(user.id) ? user.id : null,
      ]
    );

    const providedPlatforms = normalizePlatformPayloads(payload.platforms);
    const defaultPlatforms = providedPlatforms.length
      ? providedPlatforms
      : await getDefaultPlatformLinks(context.release.id, context.track?.id || null, client);

    await insertPlatforms(client, insertResult.rows[0].id, defaultPlatforms);
    await client.query("COMMIT");

    const platforms = await getPlatformsForSmartLink(insertResult.rows[0].id);
    const row = await getSmartLinkRow("id", insertResult.rows[0].id);
    return formatSmartLink(row, platforms);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getSmartLinkById = async (user, id) => {
  await ensureMarketingSchema();

  const access = await assertSmartLinkAccess(user, id, "read");
  if (!access) {
    const error = new Error("Smart link not found or inaccessible.");
    error.status = 404;
    throw error;
  }

  const row = await getSmartLinkRow("id", id);
  const platforms = await getPlatformsForSmartLink(id);
  return formatSmartLink(row, platforms);
};

const getSmartLinkBySlug = async (slug) => {
  await ensureMarketingSchema();

  const row = await getSmartLinkRow("slug", slug);
  if (!row || !["active", "pre_save"].includes(row.status)) {
    const error = new Error("Smart link not found.");
    error.status = 404;
    throw error;
  }

  const platforms = await getPlatformsForSmartLink(row.id, true);
  return formatSmartLink(row, platforms);
};

const updateSmartLink = async (user, id, payload = {}) => {
  await ensureMarketingSchema();

  const access = await assertSmartLinkAccess(user, id, "manage");
  if (!access) {
    const error = new Error("You do not have permission to update this smart link.");
    error.status = 403;
    throw error;
  }

  const current = await getSmartLinkRow("id", id);
  const nextSlug =
    payload.slug && slugify(payload.slug) !== current.slug
      ? await ensureUniqueSlug(payload.slug, pool, id)
      : current.slug;

  await pool.query(
    `
    UPDATE smart_links
    SET slug = $1,
        title = $2,
        description = $3,
        artwork_url = $4,
        status = $5,
        updated_at = NOW()
    WHERE id = $6
    `,
    [
      nextSlug,
      normalizeText(payload.title) || current.title,
      payload.description === undefined ? current.description : normalizeText(payload.description),
      normalizeText(payload.artwork_url || payload.artworkUrl) || current.artwork_url,
      normalizeStatus(payload.status, current.status || "active"),
      id,
    ]
  );

  if (Array.isArray(payload.platforms)) {
    await insertPlatforms(pool, id, normalizePlatformPayloads(payload.platforms));
  }

  return getSmartLinkById(user, id);
};

const deleteSmartLink = async (user, id) => {
  await ensureMarketingSchema();

  const access = await assertSmartLinkAccess(user, id, "manage");
  if (!access) {
    const error = new Error("You do not have permission to delete this smart link.");
    error.status = 403;
    throw error;
  }

  await pool.query("UPDATE smart_links SET status = 'archived', updated_at = NOW() WHERE id = $1", [id]);
  return { id, status: "archived" };
};

const addPlatform = async (user, smartLinkId, payload = {}) => {
  await ensureMarketingSchema();

  const access = await assertSmartLinkAccess(user, smartLinkId, "manage");
  if (!access) {
    const error = new Error("You do not have permission to update this smart link.");
    error.status = 403;
    throw error;
  }

  const platforms = normalizePlatformPayloads([payload]);
  if (!platforms.length) {
    const error = new Error("Platform and valid URL are required.");
    error.status = 400;
    throw error;
  }

  await insertPlatforms(pool, smartLinkId, platforms);
  return getPlatformsForSmartLink(smartLinkId);
};

const updatePlatform = async (user, smartLinkId, platformId, payload = {}) => {
  await ensureMarketingSchema();

  const access = await assertSmartLinkAccess(user, smartLinkId, "manage");
  if (!access) {
    const error = new Error("You do not have permission to update this smart link.");
    error.status = 403;
    throw error;
  }

  const currentResult = await pool.query(
    "SELECT * FROM smart_link_platforms WHERE id = $1 AND smart_link_id = $2 LIMIT 1",
    [platformId, smartLinkId]
  );
  const current = currentResult.rows[0];

  if (!current) {
    const error = new Error("Platform button not found.");
    error.status = 404;
    throw error;
  }

  const nextPlatform = canonicalPlatform(payload.platform) || current.platform;
  const nextUrl = validateUrl(payload.url) || current.url;

  await pool.query(
    `
    UPDATE smart_link_platforms
    SET platform = $1,
        url = $2,
        button_text = $3,
        display_order = $4,
        is_active = $5,
        updated_at = NOW()
    WHERE id = $6 AND smart_link_id = $7
    `,
    [
      nextPlatform,
      nextUrl,
      payload.button_text === undefined ? current.button_text : normalizeText(payload.button_text),
      Number.isFinite(Number(payload.display_order)) ? Number(payload.display_order) : current.display_order,
      payload.is_active === undefined ? current.is_active : payload.is_active !== false,
      platformId,
      smartLinkId,
    ]
  );

  return getPlatformsForSmartLink(smartLinkId);
};

const deletePlatform = async (user, smartLinkId, platformId) => {
  await ensureMarketingSchema();

  const access = await assertSmartLinkAccess(user, smartLinkId, "manage");
  if (!access) {
    const error = new Error("You do not have permission to update this smart link.");
    error.status = 403;
    throw error;
  }

  await pool.query("DELETE FROM smart_link_platforms WHERE id = $1 AND smart_link_id = $2", [platformId, smartLinkId]);
  return getPlatformsForSmartLink(smartLinkId);
};

const recordSmartLinkClick = async (slug, payload = {}, req) => {
  await ensureMarketingSchema();

  const smartLink = await getSmartLinkBySlug(slug);
  const platformId = normalizeText(payload.platform_id || payload.platformId);
  const platformName = canonicalPlatform(payload.platform);
  let platform = null;

  if (platformId) {
    const result = await pool.query(
      "SELECT * FROM smart_link_platforms WHERE smart_link_id = $1 AND id = $2 AND is_active = true LIMIT 1",
      [smartLink.id, platformId]
    );
    platform = result.rows[0] || null;
  } else if (platformName) {
    const result = await pool.query(
      "SELECT * FROM smart_link_platforms WHERE smart_link_id = $1 AND LOWER(platform) = LOWER($2) AND is_active = true LIMIT 1",
      [smartLink.id, platformName]
    );
    platform = result.rows[0] || null;
  }

  if ((platformId || platformName) && !platform) {
    const error = new Error("Platform link not found.");
    error.status = 404;
    throw error;
  }

  const geo = getRequestGeo(req, payload);
  const referrer = normalizeText(payload.referrer) || normalizeText(req.headers?.referer) || normalizeText(req.headers?.referrer);
  const clickedPlatform = platform?.platform || platformName || "landing";

  await pool.query(
    `
    INSERT INTO smart_link_clicks (smart_link_id, platform, ip_hash, user_agent, country, city, referrer)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      smartLink.id,
      clickedPlatform,
      getRequestIpHash(req),
      normalizeText(req.headers?.["user-agent"]),
      geo.country,
      geo.city,
      referrer,
    ]
  );

  await pool.query("UPDATE smart_links SET click_count = click_count + 1, updated_at = NOW() WHERE id = $1", [
    smartLink.id,
  ]);

  return {
    smart_link_id: smartLink.id,
    platform: clickedPlatform,
    url: platform?.url || smartLink.public_url,
  };
};

const buildClickFilters = (user, query = {}) => {
  const values = [];
  const conditions = ["COALESCE(sl.status, 'active') <> 'archived'"];
  const accessCondition = getReleaseAccessCondition(user, values, "r", "read");

  if (accessCondition) {
    conditions.push(accessCondition);
  }

  if (query.from) {
    values.push(query.from);
    conditions.push(`slc.clicked_at::date >= $${values.length}`);
  }

  if (query.to) {
    values.push(query.to);
    conditions.push(`slc.clicked_at::date <= $${values.length}`);
  }

  if (query.releaseId) {
    values.push(query.releaseId);
    conditions.push(`sl.release_id = $${values.length}`);
  }

  return { values, where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "" };
};

const getSmartLinkAnalytics = async (user, id, query = {}) => {
  await ensureMarketingSchema();

  const access = await assertSmartLinkAccess(user, id, "read");
  if (!access) {
    const error = new Error("Smart link not found or inaccessible.");
    error.status = 404;
    throw error;
  }

  const values = [id];
  const conditions = ["slc.smart_link_id = $1"];

  if (query.from) {
    values.push(query.from);
    conditions.push(`slc.clicked_at::date >= $${values.length}`);
  }

  if (query.to) {
    values.push(query.to);
    conditions.push(`slc.clicked_at::date <= $${values.length}`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const [summary, platformClicks, countryClicks, cityClicks, referrers, dailyClicks, recentClicks] =
    await Promise.all([
      pool.query(
        `
        SELECT
          COUNT(*)::int AS total_clicks,
          COUNT(*) FILTER (WHERE platform IS NOT NULL AND platform <> 'landing')::int AS platform_clicks,
          COUNT(DISTINCT ip_hash)::int AS unique_visitors,
          MIN(clicked_at) AS first_click_at,
          MAX(clicked_at) AS last_click_at
        FROM smart_link_clicks slc
        ${where}
        `,
        values
      ),
      pool.query(
        `
        SELECT COALESCE(platform, 'Unknown') AS platform, COUNT(*)::int AS clicks
        FROM smart_link_clicks slc
        ${where}
        GROUP BY COALESCE(platform, 'Unknown')
        ORDER BY clicks DESC, platform ASC
        `,
        values
      ),
      pool.query(
        `
        SELECT COALESCE(country, 'Unknown') AS country, COUNT(*)::int AS clicks
        FROM smart_link_clicks slc
        ${where}
        GROUP BY COALESCE(country, 'Unknown')
        ORDER BY clicks DESC, country ASC
        LIMIT 20
        `,
        values
      ),
      pool.query(
        `
        SELECT COALESCE(city, 'Unknown') AS city, COUNT(*)::int AS clicks
        FROM smart_link_clicks slc
        ${where}
        GROUP BY COALESCE(city, 'Unknown')
        ORDER BY clicks DESC, city ASC
        LIMIT 20
        `,
        values
      ),
      pool.query(
        `
        SELECT COALESCE(NULLIF(referrer, ''), 'Direct') AS referrer, COUNT(*)::int AS clicks
        FROM smart_link_clicks slc
        ${where}
        GROUP BY COALESCE(NULLIF(referrer, ''), 'Direct')
        ORDER BY clicks DESC, referrer ASC
        LIMIT 20
        `,
        values
      ),
      pool.query(
        `
        SELECT slc.clicked_at::date AS date, COUNT(*)::int AS clicks
        FROM smart_link_clicks slc
        ${where}
        GROUP BY slc.clicked_at::date
        ORDER BY date ASC
        `,
        values
      ),
      pool.query(
        `
        SELECT platform, country, city, referrer, clicked_at
        FROM smart_link_clicks slc
        ${where}
        ORDER BY clicked_at DESC
        LIMIT 25
        `,
        values
      ),
    ]);

  const smartLink = await getSmartLinkById(user, id);
  const summaryRow = summary.rows[0] || {};
  const total = Number(summaryRow.total_clicks || 0);
  const platformTotal = Number(summaryRow.platform_clicks || 0);

  return {
    smartLink,
    summary: {
      total_clicks: total,
      platform_clicks: platformTotal,
      unique_visitors: Number(summaryRow.unique_visitors || 0),
      conversion_rate: total ? Math.round((platformTotal / total) * 1000) / 10 : 0,
      first_click_at: summaryRow.first_click_at,
      last_click_at: summaryRow.last_click_at,
    },
    platformClicks: platformClicks.rows,
    countryClicks: countryClicks.rows,
    cityClicks: cityClicks.rows,
    referrers: referrers.rows,
    dailyClicks: dailyClicks.rows,
    recentClicks: recentClicks.rows,
  };
};

const getMarketingOverview = async (user, query = {}) => {
  await ensureMarketingSchema();

  const filters = buildClickFilters(user, query);
  const linkValues = [];
  const linkConditions = ["COALESCE(sl.status, 'active') <> 'archived'"];
  const linkAccess = getReleaseAccessCondition(user, linkValues, "r", "read");

  if (linkAccess) {
    linkConditions.push(linkAccess);
  }

  const linkWhere = `WHERE ${linkConditions.join(" AND ")}`;

  const [linkSummary, clickSummary, platformClicks, countryClicks, referrers, dailyClicks, topReleases, topLinks] =
    await Promise.all([
      pool.query(
        `
        SELECT COUNT(DISTINCT sl.id)::int AS total_smart_links,
               COUNT(DISTINCT sl.release_id)::int AS linked_releases
        FROM smart_links sl
        LEFT JOIN releases r ON r.id = sl.release_id
        ${linkWhere}
        `,
        linkValues
      ),
      pool.query(
        `
        SELECT COUNT(slc.id)::int AS total_clicks,
               COUNT(DISTINCT slc.ip_hash)::int AS unique_visitors
        FROM smart_link_clicks slc
        JOIN smart_links sl ON sl.id = slc.smart_link_id
        LEFT JOIN releases r ON r.id = sl.release_id
        ${filters.where}
        `,
        filters.values
      ),
      pool.query(
        `
        SELECT COALESCE(slc.platform, 'Unknown') AS platform, COUNT(*)::int AS clicks
        FROM smart_link_clicks slc
        JOIN smart_links sl ON sl.id = slc.smart_link_id
        LEFT JOIN releases r ON r.id = sl.release_id
        ${filters.where}
        GROUP BY COALESCE(slc.platform, 'Unknown')
        ORDER BY clicks DESC, platform ASC
        LIMIT 12
        `,
        filters.values
      ),
      pool.query(
        `
        SELECT COALESCE(slc.country, 'Unknown') AS country, COUNT(*)::int AS clicks
        FROM smart_link_clicks slc
        JOIN smart_links sl ON sl.id = slc.smart_link_id
        LEFT JOIN releases r ON r.id = sl.release_id
        ${filters.where}
        GROUP BY COALESCE(slc.country, 'Unknown')
        ORDER BY clicks DESC, country ASC
        LIMIT 12
        `,
        filters.values
      ),
      pool.query(
        `
        SELECT COALESCE(NULLIF(slc.referrer, ''), 'Direct') AS referrer, COUNT(*)::int AS clicks
        FROM smart_link_clicks slc
        JOIN smart_links sl ON sl.id = slc.smart_link_id
        LEFT JOIN releases r ON r.id = sl.release_id
        ${filters.where}
        GROUP BY COALESCE(NULLIF(slc.referrer, ''), 'Direct')
        ORDER BY clicks DESC, referrer ASC
        LIMIT 12
        `,
        filters.values
      ),
      pool.query(
        `
        SELECT slc.clicked_at::date AS date, COUNT(*)::int AS clicks
        FROM smart_link_clicks slc
        JOIN smart_links sl ON sl.id = slc.smart_link_id
        LEFT JOIN releases r ON r.id = sl.release_id
        ${filters.where}
        GROUP BY slc.clicked_at::date
        ORDER BY date ASC
        `,
        filters.values
      ),
      pool.query(
        `
        SELECT
          sl.release_id,
          COALESCE(r.release_title, r.title, r.album_name) AS release_title,
          r.primary_artist,
          COALESCE(r.artwork_url, af.file_path, af.file_url) AS artwork_url,
          COUNT(slc.id)::int AS clicks
        FROM smart_links sl
        LEFT JOIN releases r ON r.id = sl.release_id
        LEFT JOIN smart_link_clicks slc ON slc.smart_link_id = sl.id
        LEFT JOIN LATERAL (
          SELECT file_path, file_url
          FROM release_files
          WHERE release_id = r.id AND file_type = 'artwork'
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        ) af ON true
        ${linkWhere}
        GROUP BY sl.release_id, r.id, af.file_path, af.file_url
        ORDER BY clicks DESC, release_title ASC
        LIMIT 10
        `,
        linkValues
      ),
      pool.query(
        `
        SELECT
          sl.*,
          COALESCE(r.release_title, r.title, r.album_name) AS release_title,
          r.primary_artist,
          COUNT(slc.id)::int AS tracked_clicks
        FROM smart_links sl
        LEFT JOIN releases r ON r.id = sl.release_id
        LEFT JOIN smart_link_clicks slc ON slc.smart_link_id = sl.id
        ${linkWhere}
        GROUP BY sl.id, r.id
        ORDER BY tracked_clicks DESC, sl.updated_at DESC
        LIMIT 10
        `,
        linkValues
      ),
    ]);

  const clicks = clickSummary.rows[0] || {};

  return {
    summary: {
      total_smart_links: Number(linkSummary.rows[0]?.total_smart_links || 0),
      linked_releases: Number(linkSummary.rows[0]?.linked_releases || 0),
      total_clicks: Number(clicks.total_clicks || 0),
      unique_visitors: Number(clicks.unique_visitors || 0),
    },
    platformClicks: platformClicks.rows,
    countryClicks: countryClicks.rows,
    referrers: referrers.rows,
    dailyClicks: dailyClicks.rows,
    topReleases: topReleases.rows,
    topLinks: topLinks.rows.map((row) => formatSmartLink(row)),
  };
};

const getPublicReleasePage = async (releaseSlug, trackSlug = null) => {
  await ensureMarketingSchema();

  const releaseResult = await pool.query(
    `
    SELECT
      r.*,
      r.id AS release_id,
      COALESCE(r.release_title, r.title, r.album_name) AS release_title,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(r.permalink_slug, r.release_title, r.title, r.album_name, r.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) AS release_slug,
      COALESCE(r.artwork_url, af.file_path, af.file_url) AS artwork_url
    FROM releases r
    LEFT JOIN LATERAL (
      SELECT file_path, file_url
      FROM release_files
      WHERE release_id = r.id AND file_type = 'artwork'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) af ON true
    WHERE r.id::text = $1
       OR LOWER(r.permalink_slug) = LOWER($1)
       OR LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(r.release_title, r.title, r.album_name, r.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) = LOWER($1)
    LIMIT 1
    `,
    [releaseSlug]
  );

  const release = releaseResult.rows[0];
  if (!release) {
    const error = new Error("Release not found.");
    error.status = 404;
    throw error;
  }

  const tracksResult = await pool.query(
    `
    SELECT
      t.*,
      t.id AS track_id,
      COALESCE(t.title, t.song_name) AS track_title,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(t.title, t.song_name, t.isrc, t.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) AS track_slug
    FROM tracks t
    WHERE t.release_id = $1
    ORDER BY t.created_at ASC, t.id ASC
    `,
    [release.id]
  );

  const tracks = tracksResult.rows.map(formatTrackRow);
  const selectedTrack = trackSlug
    ? tracksResult.rows.find(
        (track) =>
          String(track.id) === String(trackSlug) ||
          String(track.track_slug).toLowerCase() === String(trackSlug).toLowerCase()
      )
    : null;

  if (trackSlug && !selectedTrack) {
    const error = new Error("Track not found.");
    error.status = 404;
    throw error;
  }

  const smartLinkResult = await pool.query(
    `
    SELECT *
    FROM smart_links
    WHERE release_id = $1
      AND COALESCE(status, 'active') IN ('active', 'pre_save')
      AND ($2::uuid IS NULL OR track_id = $2::uuid)
    ORDER BY track_id NULLS LAST, updated_at DESC
    LIMIT 1
    `,
    [release.id, selectedTrack?.id || null]
  );

  const smartLink = smartLinkResult.rows[0]
    ? await getSmartLinkBySlug(smartLinkResult.rows[0].slug)
    : null;
  const platforms = smartLink?.platforms?.length
    ? smartLink.platforms
    : await getDefaultPlatformLinks(release.id, selectedTrack?.id || null);

  return {
    release: formatReleaseRow(release),
    track: selectedTrack ? formatTrackRow(selectedTrack) : null,
    tracks,
    smartLink,
    platforms,
  };
};

const getPublicArtistPage = async (artistSlug) => {
  await ensureMarketingSchema();

  const artistResult = await pool.query(
    `
    SELECT
      a.*,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(a.artist_name, a.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) AS artist_slug
    FROM artists a
    WHERE a.id::text = $1
       OR LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(a.artist_name, a.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) = LOWER($1)
    LIMIT 1
    `,
    [artistSlug]
  );

  const artist = artistResult.rows[0];
  if (!artist) {
    const error = new Error("Artist not found.");
    error.status = 404;
    throw error;
  }

  const releaseResult = await pool.query(
    `
    SELECT
      r.*,
      r.id AS release_id,
      COALESCE(r.release_title, r.title, r.album_name) AS release_title,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(r.permalink_slug, r.release_title, r.title, r.album_name, r.id::text), '[^a-zA-Z0-9]+', '-', 'g'))) AS release_slug,
      COALESCE(r.artwork_url, af.file_path, af.file_url) AS artwork_url,
      sl.id AS smart_link_id,
      sl.slug AS smart_link_slug,
      sl.click_count
    FROM releases r
    LEFT JOIN smart_links sl ON sl.release_id = r.id AND COALESCE(sl.status, 'active') IN ('active', 'pre_save')
    LEFT JOIN LATERAL (
      SELECT file_path, file_url
      FROM release_files
      WHERE release_id = r.id AND file_type = 'artwork'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) af ON true
    WHERE r.artist_id = $1
       OR LOWER(r.primary_artist) = LOWER($2)
    ORDER BY COALESCE(r.release_date, r.created_at::date) DESC, r.created_at DESC
    LIMIT 40
    `,
    [artist.id, artist.artist_name]
  );

  return {
    artist: {
      id: artist.id,
      name: artist.artist_name,
      slug: artist.artist_slug,
      country: artist.country,
      public_url: getPublicArtistUrl(artist.artist_slug),
    },
    releases: releaseResult.rows.map((row) => ({
      ...formatReleaseRow(row),
      smart_link_id: row.smart_link_id,
      smart_link_slug: row.smart_link_slug,
      smart_link_url: row.smart_link_slug ? getSmartLinkUrl(row.smart_link_slug) : null,
      click_count: Number(row.click_count || 0),
    })),
  };
};

const createPreSaveCampaign = async (user, payload = {}) => {
  await ensureMarketingSchema();

  if (!["admin", "artist", "label"].includes(user?.role)) {
    const error = new Error("You do not have permission to create pre-save campaigns.");
    error.status = 403;
    throw error;
  }

  const releaseId = normalizeText(payload.release_id || payload.releaseId);
  if (!releaseId || !(await assertReleaseAccess(user, releaseId, "manage"))) {
    const error = new Error("You do not have access to manage this release.");
    error.status = 403;
    throw error;
  }

  const context = await getReleaseContext(releaseId);
  if (!context) {
    const error = new Error("Release not found.");
    error.status = 404;
    throw error;
  }

  const title = normalizeText(payload.title) || `${context.release.release_title || context.release.title} pre-save`;
  const slug = await ensureUniqueSlug(payload.slug || title, pool, null, "pre_save_campaigns");

  const result = await pool.query(
    `
    INSERT INTO pre_save_campaigns (
      release_id, title, slug, status, release_date, spotify_uri, apple_music_url, created_by, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *
    `,
    [
      releaseId,
      title,
      slug,
      normalizeCampaignStatus(payload.status, "active"),
      payload.release_date || context.release.release_date || context.release.go_live_date || null,
      normalizeText(payload.spotify_uri || payload.spotifyUri),
      validateUrl(payload.apple_music_url || payload.appleMusicUrl),
      isUuid(user.id) ? user.id : null,
    ]
  );

  return result.rows[0];
};

const getPreSaveCampaignBySlug = async (slug) => {
  await ensureMarketingSchema();

  const result = await pool.query(
    `
    SELECT
      psc.*,
      COALESCE(r.release_title, r.title, r.album_name) AS release_title,
      r.primary_artist,
      COALESCE(r.artwork_url, af.file_path, af.file_url) AS artwork_url
    FROM pre_save_campaigns psc
    LEFT JOIN releases r ON r.id = psc.release_id
    LEFT JOIN LATERAL (
      SELECT file_path, file_url
      FROM release_files
      WHERE release_id = r.id AND file_type = 'artwork'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) af ON true
    WHERE LOWER(psc.slug) = LOWER($1)
      AND psc.status = 'active'
    LIMIT 1
    `,
    [slug]
  );

  const campaign = result.rows[0];
  if (!campaign) {
    const error = new Error("Pre-save campaign not found.");
    error.status = 404;
    throw error;
  }

  return {
    ...campaign,
    public_url: `${getPublicOrigin()}/pre-save/${campaign.slug}`,
  };
};

const subscribePreSave = async (slug, payload = {}) => {
  const campaign = await getPreSaveCampaignBySlug(slug);
  const email = normalizeText(payload.email)?.toLowerCase();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const error = new Error("A valid email address is required.");
    error.status = 400;
    throw error;
  }

  const result = await pool.query(
    `
    INSERT INTO pre_save_subscribers (campaign_id, name, email, platform)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (campaign_id, LOWER(email))
    DO UPDATE SET name = COALESCE(EXCLUDED.name, pre_save_subscribers.name),
                  platform = COALESCE(EXCLUDED.platform, pre_save_subscribers.platform)
    RETURNING id, campaign_id, name, email, platform, created_at
    `,
    [campaign.id, normalizeText(payload.name), email, canonicalPlatform(payload.platform)]
  );

  return result.rows[0];
};

const getPromoKit = async (user, releaseId) => {
  await ensureMarketingSchema();

  if (!(await assertReleaseAccess(user, releaseId, "read"))) {
    const error = new Error("Release not found or inaccessible.");
    error.status = 404;
    throw error;
  }

  const context = await getReleaseContext(releaseId);
  if (!context) {
    const error = new Error("Release not found.");
    error.status = 404;
    throw error;
  }

  const smartLinkResult = await pool.query(
    `
    SELECT id, slug
    FROM smart_links
    WHERE release_id = $1 AND COALESCE(status, 'active') <> 'archived'
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
    `,
    [releaseId]
  );
  const smartLink = smartLinkResult.rows[0] ? await getSmartLinkById(user, smartLinkResult.rows[0].id) : null;
  const platforms = smartLink?.platforms?.length
    ? smartLink.platforms
    : await getDefaultPlatformLinks(releaseId, null);
  const campaigns = await pool.query(
    "SELECT * FROM pre_save_campaigns WHERE release_id = $1 ORDER BY created_at DESC",
    [releaseId]
  );

  const releaseSlug = context.release.release_slug || slugify(context.release.release_title || context.release.title);

  return {
    release: formatReleaseRow(context.release),
    tracks: context.tracks.map(formatTrackRow),
    smartLink,
    platforms,
    preSaveCampaigns: campaigns.rows,
    public_release_url: getPublicReleaseUrl(releaseSlug),
    captions: {
      launch: `Listen to ${context.release.release_title || context.release.title} by ${
        context.release.primary_artist || "our artist"
      } now: ${smartLink?.public_url || getPublicReleaseUrl(releaseSlug)}`,
      short: `${context.release.release_title || context.release.title} is out now.`,
      whatsapp: `New release from ${context.release.primary_artist || "Nixa Music"}: ${
        smartLink?.public_url || getPublicReleaseUrl(releaseSlug)
      }`,
    },
    artwork_url: context.release.artwork_url,
  };
};

module.exports = {
  addPlatform,
  createPreSaveCampaign,
  createSmartLink,
  deletePlatform,
  deleteSmartLink,
  getMarketingOverview,
  getPlatformsForSmartLink,
  getPreSaveCampaignBySlug,
  getPromoKit,
  getPublicArtistPage,
  getPublicReleasePage,
  getSmartLinkAnalytics,
  getSmartLinkById,
  getSmartLinkBySlug,
  listSmartLinks,
  recordSmartLinkClick,
  subscribePreSave,
  updatePlatform,
  updateSmartLink,
};
