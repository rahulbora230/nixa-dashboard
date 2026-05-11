const pool = require("../../config/db");
const { recalculateRevenue } = require("../revenue/revenueService");
const { ensureFinanceSchema } = require("./financeSchema");

const allowedSplitTypes = new Set(["artist", "label", "track", "release"]);
const allowedStatuses = new Set(["active", "inactive"]);

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const cleanText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
};

const normalizeDate = (value, fallback = null) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = cleanText(value);

  if (!text) {
    return fallback;
  }

  return /^\d{4}-\d{2}$/.test(text) ? `${text}-01` : text;
};

const getPayloadValue = (payload, ...keys) => {
  for (const key of keys) {
    if (payload[key] !== undefined) {
      return payload[key];
    }
  }

  return undefined;
};

const normalizeSplitPayload = (payload = {}) => {
  const splitType = cleanText(getPayloadValue(payload, "split_type", "splitType")) || "artist";
  const artistPercentage = toNumber(getPayloadValue(payload, "artist_percentage", "artistPercentage", "split_percentage"), 80);
  const labelPercentage = toNumber(getPayloadValue(payload, "label_percentage", "labelPercentage"), 0);
  const companyInput = getPayloadValue(payload, "company_percentage", "companyPercentage");
  const companyPercentage =
    companyInput === undefined ? Number((100 - artistPercentage - labelPercentage).toFixed(2)) : toNumber(companyInput);
  const total = Number((artistPercentage + labelPercentage + companyPercentage).toFixed(2));

  if (!allowedSplitTypes.has(splitType)) {
    throw new Error("Invalid split type.");
  }

  if ([artistPercentage, labelPercentage, companyPercentage].some((value) => value < 0 || value > 100)) {
    throw new Error("Split percentages must be between 0 and 100.");
  }

  if (Math.abs(total - 100) > 0.01) {
    throw new Error("Artist, label and company percentages must total 100%.");
  }

  const effectiveFrom = normalizeDate(getPayloadValue(payload, "effective_from", "effectiveFrom"), "2000-01-01");
  const effectiveTo = normalizeDate(getPayloadValue(payload, "effective_to", "effectiveTo"));
  const status = cleanText(payload.status) || "active";

  if (!allowedStatuses.has(status)) {
    throw new Error("Invalid split status.");
  }

  return {
    artistId: isUuid(getPayloadValue(payload, "artist_id", "artistId")) ? getPayloadValue(payload, "artist_id", "artistId") : null,
    labelId: isUuid(getPayloadValue(payload, "label_id", "labelId")) ? getPayloadValue(payload, "label_id", "labelId") : null,
    releaseId: isUuid(getPayloadValue(payload, "release_id", "releaseId")) ? getPayloadValue(payload, "release_id", "releaseId") : null,
    trackId: isUuid(getPayloadValue(payload, "track_id", "trackId")) ? getPayloadValue(payload, "track_id", "trackId") : null,
    isrc: cleanText(payload.isrc)?.toUpperCase() || null,
    splitType,
    artistPercentage,
    companyPercentage,
    labelPercentage,
    effectiveFrom,
    effectiveTo,
    status,
    notes: cleanText(payload.notes),
  };
};

const mapSplitRow = (row) => ({
  id: row.id,
  artistId: row.artist_id,
  artistName: row.artist_name,
  labelId: row.label_id,
  labelName: row.label_name,
  releaseId: row.release_id,
  releaseTitle: row.release_title,
  trackId: row.track_id,
  trackTitle: row.track_title,
  isrc: row.isrc,
  splitType: row.split_type || row.owner_type || "artist",
  artistPercentage: toNumber(row.artist_percentage ?? row.split_percentage, 80),
  labelPercentage: toNumber(row.label_percentage, 0),
  companyPercentage: toNumber(row.company_percentage, 20),
  effectiveFrom: row.effective_from,
  effectiveTo: row.effective_to,
  status: row.status || "active",
  notes: row.notes,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const splitSelect = `
  SELECT
    rs.*,
    a.artist_name,
    l.label_name,
    r.title AS release_title,
    COALESCE(t.title, t.song_name) AS track_title
  FROM revenue_splits rs
  LEFT JOIN artists a ON a.id = rs.artist_id
  LEFT JOIN labels l ON l.id = rs.label_id
  LEFT JOIN releases r ON r.id = rs.release_id
  LEFT JOIN tracks t ON t.id = rs.track_id
`;

const listSplits = async ({ query = {} }) => {
  await ensureFinanceSchema();

  const values = [];
  const conditions = [];
  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.status) {
    conditions.push(`rs.status = ${addValue(query.status)}`);
  }

  if (query.splitType || query.split_type) {
    conditions.push(`rs.split_type = ${addValue(query.splitType || query.split_type)}`);
  }

  if (isUuid(query.artistId || query.artist_id)) {
    conditions.push(`rs.artist_id = ${addValue(query.artistId || query.artist_id)}`);
  }

  if (isUuid(query.labelId || query.label_id)) {
    conditions.push(`rs.label_id = ${addValue(query.labelId || query.label_id)}`);
  }

  if (query.search) {
    const term = `%${String(query.search).trim()}%`;
    const placeholder = addValue(term);
    conditions.push(`
      (
        rs.isrc ILIKE ${placeholder}
        OR rs.notes ILIKE ${placeholder}
        OR a.artist_name ILIKE ${placeholder}
        OR l.label_name ILIKE ${placeholder}
        OR r.title ILIKE ${placeholder}
        OR COALESCE(t.title, t.song_name) ILIKE ${placeholder}
      )
    `);
  }

  const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || "12", 10), 1), 100);
  const offset = (page - 1) * limit;
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    ${splitSelect}
    ${where}
    ORDER BY rs.effective_from DESC, rs.created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM revenue_splits rs
    LEFT JOIN artists a ON a.id = rs.artist_id
    LEFT JOIN labels l ON l.id = rs.label_id
    LEFT JOIN releases r ON r.id = rs.release_id
    LEFT JOIN tracks t ON t.id = rs.track_id
    ${where}
    `,
    values
  );

  const total = Number(countResult.rows[0]?.total || 0);

  return {
    splits: result.rows.map(mapSplitRow),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const getSplitById = async (id) => {
  await ensureFinanceSchema();

  const result = await pool.query(
    `
    ${splitSelect}
    WHERE rs.id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ? mapSplitRow(result.rows[0]) : null;
};

const createSplit = async ({ payload, user }) => {
  await ensureFinanceSchema();
  const split = normalizeSplitPayload(payload);

  const result = await pool.query(
    `
    INSERT INTO revenue_splits (
      owner_type,
      owner_id,
      split_percentage,
      artist_id,
      label_id,
      release_id,
      track_id,
      isrc,
      split_type,
      artist_percentage,
      company_percentage,
      label_percentage,
      effective_from,
      effective_to,
      status,
      notes,
      created_by,
      updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW()
    )
    RETURNING *
    `,
    [
      split.splitType,
      split.artistId || split.labelId || split.trackId || split.releaseId,
      split.artistPercentage,
      split.artistId,
      split.labelId,
      split.releaseId,
      split.trackId,
      split.isrc,
      split.splitType,
      split.artistPercentage,
      split.companyPercentage,
      split.labelPercentage,
      split.effectiveFrom,
      split.effectiveTo,
      split.status,
      split.notes,
      isUuid(user?.id) ? user.id : null,
    ]
  );

  return mapSplitRow(result.rows[0]);
};

const replaceSplit = async ({ id, payload, user }) => {
  await ensureFinanceSchema();
  const existing = await getSplitById(id);

  if (!existing) {
    return null;
  }

  const merged = {
    artist_id: existing.artistId,
    label_id: existing.labelId,
    release_id: existing.releaseId,
    track_id: existing.trackId,
    isrc: existing.isrc,
    split_type: existing.splitType,
    artist_percentage: existing.artistPercentage,
    label_percentage: existing.labelPercentage,
    company_percentage: existing.companyPercentage,
    effective_from: existing.effectiveFrom,
    effective_to: existing.effectiveTo,
    status: existing.status,
    notes: existing.notes,
    ...payload,
  };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
      UPDATE revenue_splits
      SET status = 'inactive',
          effective_to = COALESCE(effective_to, CURRENT_DATE),
          updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    );

    const split = normalizeSplitPayload(merged);
    const result = await client.query(
      `
      INSERT INTO revenue_splits (
        owner_type,
        owner_id,
        split_percentage,
        artist_id,
        label_id,
        release_id,
        track_id,
        isrc,
        split_type,
        artist_percentage,
        company_percentage,
        label_percentage,
        effective_from,
        effective_to,
        status,
        notes,
        created_by,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW()
      )
      RETURNING *
      `,
      [
        split.splitType,
        split.artistId || split.labelId || split.trackId || split.releaseId,
        split.artistPercentage,
        split.artistId,
        split.labelId,
        split.releaseId,
        split.trackId,
        split.isrc,
        split.splitType,
        split.artistPercentage,
        split.companyPercentage,
        split.labelPercentage,
        split.effectiveFrom,
        split.effectiveTo,
        split.status,
        split.notes,
        isUuid(user?.id) ? user.id : null,
      ]
    );

    await client.query("COMMIT");
    return mapSplitRow(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateSplitStatus = async ({ id, status }) => {
  await ensureFinanceSchema();

  if (!allowedStatuses.has(status)) {
    throw new Error("Invalid split status.");
  }

  const result = await pool.query(
    `
    UPDATE revenue_splits
    SET status = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [status, id]
  );

  return result.rows[0] ? mapSplitRow(result.rows[0]) : null;
};

const getSplitHistory = async (artistId) => {
  await ensureFinanceSchema();

  if (!isUuid(artistId)) {
    throw new Error("Valid artist id is required.");
  }

  const result = await pool.query(
    `
    ${splitSelect}
    WHERE rs.artist_id = $1
    ORDER BY rs.effective_from DESC, rs.created_at DESC
    `,
    [artistId]
  );

  return {
    artistId,
    history: result.rows.map(mapSplitRow),
  };
};

const recalculateSplits = async ({ user, reportMonth, importId }) =>
  recalculateRevenue({
    user,
    reportMonth,
    importId,
  });

module.exports = {
  createSplit,
  getSplitById,
  getSplitHistory,
  listSplits,
  recalculateSplits,
  replaceSplit,
  updateSplitStatus,
};
