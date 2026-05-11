const crypto = require("crypto");
const fs = require("fs");
const XLSX = require("xlsx");
const pool = require("../../config/db");
const { ensureRevenueSchema } = require("./revenueSchema");
const { canonicalPlatform, normalizeRevenueRows, parseCsvFile, parseReportMonth } = require("../../utils/csv/revenueCsvParser");

const DEFAULT_SPLIT_PERCENTAGE = 80;
const DEFAULT_COMPANY_PERCENTAGE = 20;
const DEFAULT_LABEL_PERCENTAGE = 0;
const DEFAULT_PLATFORM_FEE_PERCENTAGE = 0;
const DEFAULT_GST_PERCENTAGE = Number(process.env.FINANCE_GST_PERCENTAGE || 0);
const DEFAULT_TDS_PERCENTAGE = Number(process.env.FINANCE_TDS_PERCENTAGE || 10);
const MAX_EXPORT_ROWS = 50000;

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeUnlink = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const hashFile = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const hashRevenueRow = (row) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        isrc: row.isrc,
        upc: row.upc,
        trackTitle: row.trackTitle,
        artistName: row.artistName,
        platform: row.platform,
        country: row.country,
        streams: row.streams,
        revenue: row.revenue,
        currency: row.currency,
        reportMonth: row.reportMonth,
      })
    )
    .digest("hex");

const tableExists = async (client, tableName) => {
  const result = await client.query("SELECT to_regclass($1) AS table_name", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.table_name);
};

const getUserName = async (client, userId) => {
  if (!isUuid(userId)) {
    return null;
  }

  const result = await client.query("SELECT name FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.name || null;
};

const getArtistIdsForUser = async (client, user) => {
  if (!isUuid(user?.id) || !(await tableExists(client, "artists"))) {
    return [];
  }

  const userName = await getUserName(client, user.id);
  const values = [user.id];
  const checks = ["user_id = $1"];

  if (userName) {
    values.push(userName);
    checks.push(`artist_name ILIKE $${values.length}`);
  }

  const result = await client.query(`SELECT id FROM artists WHERE ${checks.join(" OR ")}`, values);
  return result.rows.map((row) => row.id).filter(isUuid);
};

const getLabelIdsForUser = async (client, user) => {
  if (!isUuid(user?.id) || !(await tableExists(client, "labels"))) {
    return [];
  }

  const userName = await getUserName(client, user.id);
  const values = [user.id];
  const checks = ["user_id = $1"];

  if (userName) {
    values.push(userName);
    checks.push(`label_name ILIKE $${values.length}`);
  }

  const result = await client.query(`SELECT id FROM labels WHERE ${checks.join(" OR ")}`, values);
  return result.rows.map((row) => row.id).filter(isUuid);
};

const getArtistIdsForLabels = async (client, labelIds) => {
  if (!labelIds.length || !(await tableExists(client, "artist_label_map"))) {
    return [];
  }

  const result = await client.query(
    `
    SELECT DISTINCT artist_id
    FROM artist_label_map
    WHERE label_id = ANY($1::uuid[])
    `,
    [labelIds]
  );

  return result.rows.map((row) => row.artist_id).filter(isUuid);
};

const findArtistByName = async (client, artistName) => {
  if (!artistName || !(await tableExists(client, "artists"))) {
    return null;
  }

  const result = await client.query(
    `
    SELECT id
    FROM artists
    WHERE artist_name ILIKE $1
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
    `,
    [artistName]
  );

  return result.rows[0]?.id || null;
};

const findLabelByName = async (client, labelName) => {
  if (!labelName || !(await tableExists(client, "labels"))) {
    return null;
  }

  const result = await client.query(
    `
    SELECT id
    FROM labels
    WHERE label_name ILIKE $1
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
    `,
    [labelName]
  );

  return result.rows[0]?.id || null;
};

const findLabelForArtist = async (client, artistId) => {
  if (!isUuid(artistId) || !(await tableExists(client, "artist_label_map"))) {
    return null;
  }

  const result = await client.query(
    `
    SELECT label_id
    FROM artist_label_map
    WHERE artist_id = $1
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
    `,
    [artistId]
  );

  return result.rows[0]?.label_id || null;
};

const normalizeSplitRow = (row) => {
  const artistPercentage = toNumber(row.artist_percentage ?? row.split_percentage ?? DEFAULT_SPLIT_PERCENTAGE);
  const labelPercentage = toNumber(row.label_percentage ?? DEFAULT_LABEL_PERCENTAGE);
  const companyPercentage = toNumber(
    row.company_percentage ?? Math.max(100 - artistPercentage - labelPercentage, 0)
  );

  return {
    splitId: row.id || null,
    splitPercentage: artistPercentage,
    artistPercentage,
    labelPercentage,
    companyPercentage,
    platformFeePercentage: toNumber(row.platform_fee_percentage ?? DEFAULT_PLATFORM_FEE_PERCENTAGE),
  };
};

const getEffectiveSplit = async (client, { artistId, labelId, releaseId, trackId, isrc, reportMonth }) => {
  const activeWindow = `
    COALESCE(status, 'active') = 'active'
    AND effective_from <= $1
    AND (effective_to IS NULL OR effective_to >= $1)
  `;

  const attempts = [];

  if (isUuid(trackId)) {
    attempts.push({
      sql: `SELECT * FROM revenue_splits WHERE ${activeWindow} AND track_id = $2 ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      values: [reportMonth, trackId],
    });
  }

  if (isrc) {
    attempts.push({
      sql: `SELECT * FROM revenue_splits WHERE ${activeWindow} AND UPPER(isrc) = UPPER($2) ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      values: [reportMonth, isrc],
    });
  }

  if (isUuid(releaseId)) {
    attempts.push({
      sql: `SELECT * FROM revenue_splits WHERE ${activeWindow} AND release_id = $2 ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      values: [reportMonth, releaseId],
    });
  }

  if (isUuid(artistId)) {
    attempts.push({
      sql: `SELECT * FROM revenue_splits WHERE ${activeWindow} AND artist_id = $2 ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      values: [reportMonth, artistId],
    });
    attempts.push({
      sql: `SELECT * FROM revenue_splits WHERE ${activeWindow} AND owner_type = 'artist' AND owner_id = $2 ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      values: [reportMonth, artistId],
    });
  }

  if (isUuid(labelId)) {
    attempts.push({
      sql: `SELECT * FROM revenue_splits WHERE ${activeWindow} AND label_id = $2 ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      values: [reportMonth, labelId],
    });
    attempts.push({
      sql: `SELECT * FROM revenue_splits WHERE ${activeWindow} AND owner_type = 'label' AND owner_id = $2 ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      values: [reportMonth, labelId],
    });
  }

  attempts.push({
    sql: `SELECT * FROM revenue_splits WHERE ${activeWindow} AND owner_type = 'default' AND owner_id IS NULL ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
    values: [reportMonth],
  });

  for (const attempt of attempts) {
    const result = await client.query(attempt.sql, attempt.values);

    if (result.rows[0]) {
      return normalizeSplitRow(result.rows[0]);
    }
  }

  return {
    splitId: null,
    splitPercentage: DEFAULT_SPLIT_PERCENTAGE,
    artistPercentage: DEFAULT_SPLIT_PERCENTAGE,
    labelPercentage: DEFAULT_LABEL_PERCENTAGE,
    companyPercentage: DEFAULT_COMPANY_PERCENTAGE,
    platformFeePercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
  };
};

const resolveTrackMatch = async (client, rawRevenue) => {
  if (!rawRevenue.isrc) {
    return null;
  }

  const result = await client.query(
    `
    SELECT
      t.id,
      t.owner_type,
      t.owner_id,
      t.release_id,
      r.artist_id AS release_artist_id,
      r.owner_id AS release_owner_id,
      r.label_name,
      r.primary_artist
    FROM tracks t
    LEFT JOIN releases r ON r.id = t.release_id
    WHERE UPPER(t.isrc) = UPPER($1)
    ORDER BY t.created_at DESC NULLS LAST
    LIMIT 1
    `,
    [rawRevenue.isrc]
  );

  return result.rows[0] || null;
};

const calculateRawRevenue = async (client, rawRevenue) => {
  const track = await resolveTrackMatch(client, rawRevenue);

  if (!track) {
    await client.query("DELETE FROM calculated_revenues WHERE raw_revenue_id = $1", [rawRevenue.id]);
    return { matched: false };
  }

  let artistId = null;
  let labelId = null;

  if (track.owner_type === "artist" && isUuid(track.owner_id)) {
    artistId = track.owner_id;
  }

  if (track.owner_type === "label" && isUuid(track.owner_id)) {
    labelId = track.owner_id;
  }

  if (!artistId && isUuid(track.release_artist_id)) {
    artistId = track.release_artist_id;
  }

  if (!artistId) {
    artistId = await findArtistByName(client, rawRevenue.artist_name || track.primary_artist);
  }

  if (!labelId && isUuid(track.release_owner_id)) {
    labelId = track.release_owner_id;
  }

  if (!labelId) {
    labelId = await findLabelByName(client, track.label_name);
  }

  if (!labelId && artistId) {
    labelId = await findLabelForArtist(client, artistId);
  }

  const split = await getEffectiveSplit(client, {
    artistId,
    labelId,
    releaseId: track.release_id,
    trackId: track.id,
    isrc: rawRevenue.isrc,
    reportMonth: rawRevenue.report_month,
  });

  const grossRevenue = toNumber(rawRevenue.revenue);
  const platformFee = Number(((grossRevenue * split.platformFeePercentage) / 100).toFixed(6));
  const netRevenue = Number((grossRevenue - platformFee).toFixed(6));
  const artistShare = Number(((netRevenue * split.artistPercentage) / 100).toFixed(6));
  const labelShare = Number(((netRevenue * split.labelPercentage) / 100).toFixed(6));
  const companyShare = Number(((netRevenue * split.companyPercentage) / 100).toFixed(6));
  const payableBase = Number((artistShare + labelShare).toFixed(6));
  const gstDeduction = Number(((payableBase * DEFAULT_GST_PERCENTAGE) / 100).toFixed(6));
  const tdsDeduction = Number(((payableBase * DEFAULT_TDS_PERCENTAGE) / 100).toFixed(6));
  const paidAmount = 0;
  const payableAmount = Number(Math.max(payableBase - gstDeduction - tdsDeduction, 0).toFixed(6));
  const pendingAmount = Number(Math.max(payableAmount - paidAmount, 0).toFixed(6));

  await client.query(
    `
    INSERT INTO calculated_revenues (
      raw_revenue_id,
      track_id,
      artist_id,
      label_id,
      gross_revenue,
      platform_fee,
      net_revenue,
      artist_share,
      label_share,
      company_share,
      split_percentage,
      split_id,
      gst_deduction,
      tds_deduction,
      payable_amount,
      paid_amount,
      pending_amount,
      finance_status,
      payout_status,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'unpaid','unpaid',NOW())
    ON CONFLICT (raw_revenue_id) WHERE raw_revenue_id IS NOT NULL
    DO UPDATE SET
      track_id = EXCLUDED.track_id,
      artist_id = EXCLUDED.artist_id,
      label_id = EXCLUDED.label_id,
      gross_revenue = EXCLUDED.gross_revenue,
      platform_fee = EXCLUDED.platform_fee,
      net_revenue = EXCLUDED.net_revenue,
      artist_share = EXCLUDED.artist_share,
      label_share = EXCLUDED.label_share,
      company_share = EXCLUDED.company_share,
      split_percentage = EXCLUDED.split_percentage,
      split_id = EXCLUDED.split_id,
      gst_deduction = EXCLUDED.gst_deduction,
      tds_deduction = EXCLUDED.tds_deduction,
      payable_amount = EXCLUDED.payable_amount,
      pending_amount = GREATEST(EXCLUDED.payable_amount - COALESCE(calculated_revenues.paid_amount, 0), 0),
      finance_status = CASE
        WHEN COALESCE(calculated_revenues.paid_amount, 0) >= EXCLUDED.payable_amount THEN 'paid'
        WHEN COALESCE(calculated_revenues.paid_amount, 0) > 0 THEN 'partial'
        ELSE 'unpaid'
      END,
      updated_at = NOW()
    `,
    [
      rawRevenue.id,
      track.id,
      artistId,
      labelId,
      grossRevenue,
      platformFee,
      netRevenue,
      artistShare,
      labelShare,
      companyShare,
      split.splitPercentage,
      split.splitId,
      gstDeduction,
      tdsDeduction,
      payableAmount,
      paidAmount,
      pendingAmount,
    ]
  );

  return { matched: true };
};

const insertAuditLog = async (client, user, action, entityType, entityId, metadata = {}) => {
  try {
    await client.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [isUuid(user?.id) ? user.id : null, action, entityType, entityId, metadata]
    );
  } catch (error) {
    console.warn("Audit log skipped:", error.message);
  }
};

const processRevenueFile = async ({ file, user, reportMonth, platform, currency, notes }) => {
  await ensureRevenueSchema();

  const parsedReportMonth = parseReportMonth(reportMonth);

  if (!parsedReportMonth) {
    safeUnlink(file.path);
    throw new Error("Report month is required.");
  }

  const canonicalUploadPlatform = canonicalPlatform(platform);
  const uploadCurrency = (currency || "INR").toUpperCase();
  const fileHash = hashFile(file.path);

  const existingImport = await pool.query(
    `
    SELECT *
    FROM revenue_imports
    WHERE file_hash = $1 AND platform = $2 AND report_month = $3
    LIMIT 1
    `,
    [fileHash, canonicalUploadPlatform, parsedReportMonth]
  );

  if (existingImport.rows[0]) {
    safeUnlink(file.path);
    return {
      duplicateImport: true,
      import: existingImport.rows[0],
      summary: {
        totalRows: 0,
        importedRows: 0,
        duplicateRows: 0,
        failedRows: 0,
        unmatchedRows: 0,
      },
    };
  }

  const csvRows = await parseCsvFile(file.path);
  const normalizedRows = normalizeRevenueRows(csvRows, {
    reportMonth: parsedReportMonth,
    platform: canonicalUploadPlatform,
    currency: uploadCurrency,
  });

  const client = await pool.connect();
  let importRow;

  try {
    await client.query("BEGIN");

    const importResult = await client.query(
      `
      INSERT INTO revenue_imports (
        file_name,
        file_hash,
        platform,
        report_month,
        currency,
        uploaded_by,
        total_rows,
        status,
        notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'processing',$8)
      RETURNING *
      `,
      [
        file.originalname,
        fileHash,
        canonicalUploadPlatform,
        parsedReportMonth,
        uploadCurrency,
        isUuid(user?.id) ? user.id : null,
        normalizedRows.length,
        notes || null,
      ]
    );

    importRow = importResult.rows[0];

    let importedRows = 0;
    let duplicateRows = 0;
    let failedRows = 0;
    let unmatchedRows = 0;
    const errors = [];

    for (const row of normalizedRows) {
      if (!row.isrc || !row.reportMonth) {
        failedRows += 1;
        errors.push(`Row ${row.rowNumber}: missing ISRC or report month`);
        continue;
      }

      const sourceRowHash = hashRevenueRow(row);
      const duplicateResult = await client.query("SELECT id FROM raw_revenues WHERE source_row_hash = $1 LIMIT 1", [
        sourceRowHash,
      ]);

      if (duplicateResult.rows[0]) {
        duplicateRows += 1;
        continue;
      }

      const rawResult = await client.query(
        `
        INSERT INTO raw_revenues (
          import_id,
          isrc,
          upc,
          track_title,
          track_name,
          artist_name,
          platform,
          country,
          streams,
          revenue,
          currency,
          report_month,
          raw_data_json,
          source_row_hash,
          row_number
        )
        VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *
        `,
        [
          importRow.id,
          row.isrc,
          row.upc,
          row.trackTitle,
          row.artistName,
          row.platform,
          row.country,
          row.streams,
          row.revenue,
          row.currency,
          row.reportMonth,
          row.rawData,
          sourceRowHash,
          row.rowNumber,
        ]
      );

      const calculation = await calculateRawRevenue(client, rawResult.rows[0]);

      if (!calculation.matched) {
        unmatchedRows += 1;
      }

      importedRows += 1;
    }

    const status =
      importedRows === 0 && failedRows > 0
        ? "failed"
        : duplicateRows || failedRows || unmatchedRows
          ? "partial"
          : "imported";

    const updatedImport = await client.query(
      `
      UPDATE revenue_imports
      SET imported_rows = $1,
          duplicate_rows = $2,
          failed_rows = $3,
          unmatched_rows = $4,
          status = $5,
          error_summary = $6,
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
      `,
      [importedRows, duplicateRows, failedRows, unmatchedRows, status, errors.slice(0, 10).join("\n") || null, importRow.id]
    );

    await insertAuditLog(client, user, "revenue_imported", "revenue_import", importRow.id, {
      fileName: file.originalname,
      platform: canonicalUploadPlatform,
      reportMonth: parsedReportMonth,
      importedRows,
    });

    await client.query("COMMIT");
    safeUnlink(file.path);

    return {
      duplicateImport: false,
      import: updatedImport.rows[0],
      summary: {
        totalRows: normalizedRows.length,
        importedRows,
        duplicateRows,
        failedRows,
        unmatchedRows,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    safeUnlink(file.path);
    throw error;
  } finally {
    client.release();
  }
};

const buildRevenueFilters = async (client, { user, query = {}, forcedArtistId, forcedLabelId }) => {
  const conditions = [];
  const values = [];
  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (forcedArtistId) {
    conditions.push(`cr.artist_id = ${addValue(forcedArtistId)}`);
  }

  if (forcedLabelId) {
    conditions.push(`cr.label_id = ${addValue(forcedLabelId)}`);
  }

  if (!forcedArtistId && !forcedLabelId) {
    if (user.role === "artist") {
      const artistIds = await getArtistIdsForUser(client, user);
      conditions.push(artistIds.length ? `cr.artist_id = ANY(${addValue(artistIds)}::uuid[])` : "FALSE");
    }

    if (user.role === "label") {
      const labelIds = await getLabelIdsForUser(client, user);
      const artistIds = await getArtistIdsForLabels(client, labelIds);
      const checks = [];

      if (labelIds.length) {
        checks.push(`cr.label_id = ANY(${addValue(labelIds)}::uuid[])`);
      }

      if (artistIds.length) {
        checks.push(`cr.artist_id = ANY(${addValue(artistIds)}::uuid[])`);
      }

      conditions.push(checks.length ? `(${checks.join(" OR ")})` : "FALSE");
    }
  }

  if (query.search) {
    const term = `%${String(query.search).trim()}%`;
    const placeholder = addValue(term);
    conditions.push(`
      (
        rr.isrc ILIKE ${placeholder}
        OR rr.upc ILIKE ${placeholder}
        OR COALESCE(rr.track_title, rr.track_name) ILIKE ${placeholder}
        OR rr.artist_name ILIKE ${placeholder}
      )
    `);
  }

  if (query.platform) {
    conditions.push(`rr.platform = ${addValue(canonicalPlatform(query.platform))}`);
  }

  if (query.country) {
    conditions.push(`rr.country = ${addValue(String(query.country).toUpperCase())}`);
  }

  if (query.reportMonth) {
    const month = parseReportMonth(query.reportMonth);

    if (month) {
      conditions.push(`rr.report_month = ${addValue(month)}`);
    }
  }

  if (query.importId && isUuid(query.importId)) {
    conditions.push(`rr.import_id = ${addValue(query.importId)}`);
  }

  if (query.payoutStatus) {
    conditions.push(`cr.payout_status = ${addValue(query.payoutStatus)}`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

const normalizeRevenueRecord = (row) => ({
  id: row.id,
  rawRevenueId: row.id,
  calculatedRevenueId: row.calculated_revenue_id,
  importId: row.import_id,
  isrc: row.isrc,
  upc: row.upc,
  trackTitle: row.track_title || row.track_name || "Untitled track",
  artistName: row.artist_name || "Unknown artist",
  platform: row.platform || "Others",
  country: row.country || "ZZ",
  streams: toNumber(row.streams),
  grossRevenue: toNumber(row.gross_revenue),
  platformFee: toNumber(row.platform_fee),
  netRevenue: toNumber(row.net_revenue),
  artistShare: toNumber(row.artist_share),
  labelShare: toNumber(row.label_share),
  companyShare: toNumber(row.company_share),
  splitPercentage: toNumber(row.split_percentage || DEFAULT_SPLIT_PERCENTAGE),
  gstDeduction: toNumber(row.gst_deduction),
  tdsDeduction: toNumber(row.tds_deduction),
  payableAmount: toNumber(row.payable_amount),
  paidAmount: toNumber(row.paid_amount),
  pendingAmount: toNumber(row.pending_amount),
  financeStatus: row.finance_status || "unpaid",
  payoutStatus: row.payout_status || "unpaid",
  currency: row.currency || "INR",
  reportMonth: row.report_month,
  createdAt: row.created_at,
  fileName: row.file_name,
});

const listRevenue = async ({ user, query = {}, forcedArtistId, forcedLabelId, exportMode = false }) => {
  await ensureRevenueSchema();
  const client = await pool.connect();

  try {
    const { where, values } = await buildRevenueFilters(client, { user, query, forcedArtistId, forcedLabelId });
    const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
    const limit = exportMode
      ? MAX_EXPORT_ROWS
      : Math.min(Math.max(Number.parseInt(query.limit || "12", 10), 1), 100);
    const offset = (page - 1) * limit;
    const sortMap = {
      latest: "rr.created_at DESC",
      report_month: "rr.report_month DESC",
      streams: "rr.streams DESC",
      gross_revenue: "rr.revenue DESC",
      net_revenue: "cr.net_revenue DESC NULLS LAST",
      artist_share: "cr.artist_share DESC NULLS LAST",
    };
    const orderBy = sortMap[query.sort] || sortMap.latest;

    const result = await client.query(
      `
      SELECT
        rr.*,
        cr.id AS calculated_revenue_id,
        COALESCE(cr.gross_revenue, rr.revenue) AS gross_revenue,
        cr.platform_fee,
        cr.net_revenue,
        cr.artist_share,
        cr.label_share,
        cr.company_share,
        cr.split_percentage,
        cr.gst_deduction,
        cr.tds_deduction,
        cr.payable_amount,
        cr.paid_amount,
        cr.pending_amount,
        cr.finance_status,
        cr.payout_status,
        ri.file_name,
        COUNT(*) OVER() AS total_count
      FROM raw_revenues rr
      LEFT JOIN calculated_revenues cr ON cr.raw_revenue_id = rr.id
      LEFT JOIN revenue_imports ri ON ri.id = rr.import_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      [...values, limit, offset]
    );

    const total = Number(result.rows[0]?.total_count || 0);

    return {
      records: result.rows.map(normalizeRevenueRecord),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  } finally {
    client.release();
  }
};

const getRevenueAnalytics = async ({ user, query = {}, forcedArtistId, forcedLabelId }) => {
  await ensureRevenueSchema();
  const client = await pool.connect();

  try {
    const { where, values } = await buildRevenueFilters(client, { user, query, forcedArtistId, forcedLabelId });
    const summary = await client.query(
      `
      SELECT
        COALESCE(SUM(rr.revenue), 0) AS total_gross_revenue,
        COALESCE(SUM(cr.net_revenue), 0) AS total_net_revenue,
        COALESCE(SUM(cr.artist_share), 0) AS total_artist_share,
        COALESCE(SUM(cr.label_share), 0) AS total_label_share,
        COALESCE(SUM(cr.company_share), 0) AS total_company_share,
        COALESCE(SUM(rr.streams), 0) AS total_streams,
        COUNT(DISTINCT rr.isrc) AS total_tracks,
        COUNT(DISTINCT cr.artist_id) FILTER (WHERE cr.artist_id IS NOT NULL) AS total_artists
      FROM raw_revenues rr
      LEFT JOIN calculated_revenues cr ON cr.raw_revenue_id = rr.id
      ${where}
      `,
      values
    );

    const platformBreakdown = await client.query(
      `
      SELECT
        rr.platform AS name,
        COALESCE(SUM(rr.revenue), 0) AS gross_revenue,
        COALESCE(SUM(cr.net_revenue), 0) AS net_revenue,
        COALESCE(SUM(rr.streams), 0) AS streams
      FROM raw_revenues rr
      LEFT JOIN calculated_revenues cr ON cr.raw_revenue_id = rr.id
      ${where}
      GROUP BY rr.platform
      ORDER BY gross_revenue DESC
      LIMIT 12
      `,
      values
    );

    const countryBreakdown = await client.query(
      `
      SELECT
        rr.country AS name,
        COALESCE(SUM(rr.revenue), 0) AS gross_revenue,
        COALESCE(SUM(rr.streams), 0) AS streams
      FROM raw_revenues rr
      LEFT JOIN calculated_revenues cr ON cr.raw_revenue_id = rr.id
      ${where}
      GROUP BY rr.country
      ORDER BY gross_revenue DESC
      LIMIT 12
      `,
      values
    );

    const monthlyTrend = await client.query(
      `
      SELECT
        TO_CHAR(rr.report_month, 'YYYY-MM') AS month,
        COALESCE(SUM(rr.revenue), 0) AS gross_revenue,
        COALESCE(SUM(cr.net_revenue), 0) AS net_revenue,
        COALESCE(SUM(cr.artist_share), 0) AS artist_share,
        COALESCE(SUM(rr.streams), 0) AS streams
      FROM raw_revenues rr
      LEFT JOIN calculated_revenues cr ON cr.raw_revenue_id = rr.id
      ${where}
      GROUP BY rr.report_month
      ORDER BY rr.report_month ASC
      LIMIT 18
      `,
      values
    );

    const topTracks = await client.query(
      `
      SELECT
        COALESCE(rr.track_title, rr.track_name, 'Untitled track') AS title,
        rr.artist_name AS artist,
        rr.isrc,
        COALESCE(SUM(rr.revenue), 0) AS gross_revenue,
        COALESCE(SUM(cr.artist_share), 0) AS artist_share,
        COALESCE(SUM(rr.streams), 0) AS streams
      FROM raw_revenues rr
      LEFT JOIN calculated_revenues cr ON cr.raw_revenue_id = rr.id
      ${where}
      GROUP BY COALESCE(rr.track_title, rr.track_name, 'Untitled track'), rr.artist_name, rr.isrc
      ORDER BY gross_revenue DESC
      LIMIT 8
      `,
      values
    );

    const topArtists = await client.query(
      `
      SELECT
        COALESCE(a.artist_name, rr.artist_name, 'Unknown artist') AS name,
        COALESCE(SUM(rr.revenue), 0) AS gross_revenue,
        COALESCE(SUM(cr.artist_share), 0) AS artist_share,
        COALESCE(SUM(rr.streams), 0) AS streams
      FROM raw_revenues rr
      LEFT JOIN calculated_revenues cr ON cr.raw_revenue_id = rr.id
      LEFT JOIN artists a ON a.id = cr.artist_id
      ${where}
      GROUP BY COALESCE(a.artist_name, rr.artist_name, 'Unknown artist')
      ORDER BY gross_revenue DESC
      LIMIT 8
      `,
      values
    );

    const row = summary.rows[0] || {};

    return {
      summary: {
        totalGrossRevenue: toNumber(row.total_gross_revenue),
        totalNetRevenue: toNumber(row.total_net_revenue),
        totalArtistShare: toNumber(row.total_artist_share),
        totalLabelShare: toNumber(row.total_label_share),
        totalCompanyShare: toNumber(row.total_company_share),
        totalStreams: toNumber(row.total_streams),
        totalTracks: toNumber(row.total_tracks),
        totalArtists: toNumber(row.total_artists),
      },
      platformBreakdown: platformBreakdown.rows.map((item) => ({
        name: item.name || "Others",
        grossRevenue: toNumber(item.gross_revenue),
        netRevenue: toNumber(item.net_revenue),
        streams: toNumber(item.streams),
      })),
      countryBreakdown: countryBreakdown.rows.map((item) => ({
        name: item.name || "ZZ",
        grossRevenue: toNumber(item.gross_revenue),
        streams: toNumber(item.streams),
      })),
      monthlyTrend: monthlyTrend.rows.map((item) => ({
        month: item.month,
        grossRevenue: toNumber(item.gross_revenue),
        netRevenue: toNumber(item.net_revenue),
        artistShare: toNumber(item.artist_share),
        streams: toNumber(item.streams),
      })),
      topTracks: topTracks.rows.map((item) => ({
        title: item.title,
        artist: item.artist,
        isrc: item.isrc,
        grossRevenue: toNumber(item.gross_revenue),
        artistShare: toNumber(item.artist_share),
        streams: toNumber(item.streams),
      })),
      topArtists: topArtists.rows.map((item) => ({
        name: item.name,
        grossRevenue: toNumber(item.gross_revenue),
        artistShare: toNumber(item.artist_share),
        streams: toNumber(item.streams),
      })),
    };
  } finally {
    client.release();
  }
};

const getRevenueImports = async ({ query = {} }) => {
  await ensureRevenueSchema();

  const values = [];
  const conditions = [];
  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.search) {
    const term = `%${String(query.search).trim()}%`;
    conditions.push(`(file_name ILIKE ${addValue(term)} OR platform ILIKE $${values.length})`);
  }

  if (query.platform) {
    conditions.push(`platform = ${addValue(canonicalPlatform(query.platform))}`);
  }

  if (query.reportMonth) {
    const month = parseReportMonth(query.reportMonth);

    if (month) {
      conditions.push(`report_month = ${addValue(month)}`);
    }
  }

  const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || "12", 10), 1), 100);
  const offset = (page - 1) * limit;
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT *, COUNT(*) OVER() AS total_count
    FROM revenue_imports
    ${where}
    ORDER BY created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  const total = Number(result.rows[0]?.total_count || 0);

  return {
    imports: result.rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      platform: row.platform,
      reportMonth: row.report_month,
      currency: row.currency,
      totalRows: toNumber(row.total_rows),
      importedRows: toNumber(row.imported_rows),
      duplicateRows: toNumber(row.duplicate_rows),
      failedRows: toNumber(row.failed_rows),
      unmatchedRows: toNumber(row.unmatched_rows),
      status: row.status,
      notes: row.notes,
      errorSummary: row.error_summary,
      createdAt: row.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const recalculateRevenue = async ({ user, importId, reportMonth }) => {
  await ensureRevenueSchema();
  const client = await pool.connect();

  try {
    const values = [];
    const conditions = [];

    if (importId && isUuid(importId)) {
      values.push(importId);
      conditions.push(`import_id = $${values.length}`);
    }

    if (reportMonth) {
      const month = parseReportMonth(reportMonth);

      if (month) {
        values.push(month);
        conditions.push(`report_month = $${values.length}`);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    await client.query("BEGIN");

    const rawRows = await client.query(
      `
      SELECT *
      FROM raw_revenues
      ${where}
      ORDER BY created_at ASC
      `,
      values
    );

    let recalculatedRows = 0;
    let unmatchedRows = 0;

    for (const raw of rawRows.rows) {
      const result = await calculateRawRevenue(client, raw);

      if (result.matched) {
        recalculatedRows += 1;
      } else {
        unmatchedRows += 1;
      }
    }

    await insertAuditLog(client, user, "revenue_recalculated", "revenue", null, {
      importId,
      reportMonth,
      recalculatedRows,
      unmatchedRows,
    });

    await client.query("COMMIT");

    return {
      totalRows: rawRows.rowCount,
      recalculatedRows,
      unmatchedRows,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const canAccessArtist = async (user, artistId) => {
  if (["admin", "accountant"].includes(user.role)) {
    return true;
  }

  if (user.role !== "artist") {
    return false;
  }

  const client = await pool.connect();

  try {
    const artistIds = await getArtistIdsForUser(client, user);
    return artistIds.includes(artistId);
  } finally {
    client.release();
  }
};

const canAccessLabel = async (user, labelId) => {
  if (["admin", "accountant"].includes(user.role)) {
    return true;
  }

  if (user.role !== "label") {
    return false;
  }

  const client = await pool.connect();

  try {
    const labelIds = await getLabelIdsForUser(client, user);
    return labelIds.includes(labelId);
  } finally {
    client.release();
  }
};

const exportRevenue = async ({ user, query = {}, format = "xlsx" }) => {
  const { records } = await listRevenue({ user, query, exportMode: true });
  const rows = records.map((record) => ({
    ISRC: record.isrc,
    UPC: record.upc,
    Track: record.trackTitle,
    Artist: record.artistName,
    Platform: record.platform,
    Country: record.country,
    Streams: record.streams,
    "Gross Revenue": record.grossRevenue,
    "Platform Fee": record.platformFee,
    "Net Revenue": record.netRevenue,
    "Artist Share": record.artistShare,
    "Label Share": record.labelShare,
    "Company Share": record.companyShare,
    "GST Deduction": record.gstDeduction,
    "TDS Deduction": record.tdsDeduction,
    Payable: record.payableAmount,
    Paid: record.paidAmount,
    Pending: record.pendingAmount,
    "Split Percentage": record.splitPercentage,
    Currency: record.currency,
    "Report Month": record.reportMonth,
    "Payout Status": record.payoutStatus,
  }));

  if (format === "csv") {
    const headers = Object.keys(rows[0] || { ISRC: "", Track: "" });
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");

    return {
      contentType: "text/csv",
      extension: "csv",
      buffer: Buffer.from(csv),
    };
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Revenue");

  return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
};

module.exports = {
  canAccessArtist,
  canAccessLabel,
  exportRevenue,
  getRevenueAnalytics,
  getRevenueImports,
  listRevenue,
  processRevenueFile,
  recalculateRevenue,
};
