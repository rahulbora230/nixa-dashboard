const XLSX = require("xlsx");
const pool = require("../../config/db");
const { recalculateRevenue } = require("../revenue/revenueService");
const { ensureFinanceSchema } = require("./financeSchema");

const MAX_EXPORT_ROWS = 50000;

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMonth = (value) => {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  return /^\d{4}-\d{2}$/.test(text) ? `${text}-01` : text;
};

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

const resolveOwnArtistId = async (client, user) => {
  const artistIds = await getArtistIdsForUser(client, user);
  return artistIds[0] || null;
};

const resolveOwnLabelId = async (client, user) => {
  const labelIds = await getLabelIdsForUser(client, user);
  return labelIds[0] || null;
};

const canAccessArtist = async (client, user, artistId) => {
  if (["admin", "accountant"].includes(user.role)) {
    return true;
  }

  if (user.role !== "artist") {
    return false;
  }

  const artistIds = await getArtistIdsForUser(client, user);
  return artistIds.includes(artistId);
};

const canAccessLabel = async (client, user, labelId) => {
  if (["admin", "accountant"].includes(user.role)) {
    return true;
  }

  if (user.role !== "label") {
    return false;
  }

  const labelIds = await getLabelIdsForUser(client, user);
  return labelIds.includes(labelId);
};

const buildFinanceFilters = async (client, { user, query = {}, forcedArtistId, forcedLabelId }) => {
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

  if (isUuid(query.artistId || query.artist_id)) {
    conditions.push(`cr.artist_id = ${addValue(query.artistId || query.artist_id)}`);
  }

  if (isUuid(query.labelId || query.label_id)) {
    conditions.push(`cr.label_id = ${addValue(query.labelId || query.label_id)}`);
  }

  if (isUuid(query.trackId || query.track_id)) {
    conditions.push(`cr.track_id = ${addValue(query.trackId || query.track_id)}`);
  }

  if (query.isrc) {
    conditions.push(`UPPER(rr.isrc) = UPPER(${addValue(query.isrc)})`);
  }

  if (query.platform) {
    conditions.push(`rr.platform = ${addValue(query.platform)}`);
  }

  if (query.country) {
    conditions.push(`rr.country = ${addValue(String(query.country).toUpperCase())}`);
  }

  if (query.reportMonth || query.report_month) {
    const month = normalizeMonth(query.reportMonth || query.report_month);
    conditions.push(`rr.report_month = ${addValue(month)}`);
  }

  if (query.from || query.fromMonth || query.from_month) {
    conditions.push(`rr.report_month >= ${addValue(normalizeMonth(query.from || query.fromMonth || query.from_month))}`);
  }

  if (query.to || query.toMonth || query.to_month) {
    conditions.push(`rr.report_month <= ${addValue(normalizeMonth(query.to || query.toMonth || query.to_month))}`);
  }

  if (query.revenueStatus || query.payoutStatus || query.status) {
    conditions.push(`cr.payout_status = ${addValue(query.revenueStatus || query.payoutStatus || query.status)}`);
  }

  if (query.search) {
    const term = `%${String(query.search).trim()}%`;
    const placeholder = addValue(term);
    conditions.push(`
      (
        rr.isrc ILIKE ${placeholder}
        OR COALESCE(rr.track_title, rr.track_name) ILIKE ${placeholder}
        OR rr.artist_name ILIKE ${placeholder}
        OR a.artist_name ILIKE ${placeholder}
        OR l.label_name ILIKE ${placeholder}
      )
    `);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

const financeFrom = `
  FROM raw_revenues rr
  LEFT JOIN calculated_revenues cr ON cr.raw_revenue_id = rr.id
  LEFT JOIN artists a ON a.id = cr.artist_id
  LEFT JOIN labels l ON l.id = cr.label_id
  LEFT JOIN tracks t ON t.id = cr.track_id
`;

const mapSummary = (row = {}) => ({
  grossRevenue: toNumber(row.gross_revenue),
  netRevenue: toNumber(row.net_revenue),
  artistShare: toNumber(row.artist_share),
  labelShare: toNumber(row.label_share),
  companyShare: toNumber(row.company_share),
  gstDeduction: toNumber(row.gst_deduction),
  tdsDeduction: toNumber(row.tds_deduction),
  payableBalance: toNumber(row.payable_balance),
  paidAmount: toNumber(row.paid_amount),
  pendingAmount: toNumber(row.pending_amount),
  totalStreams: toNumber(row.total_streams),
  totalTracks: toNumber(row.total_tracks),
  paidRows: toNumber(row.paid_rows),
  unpaidRows: toNumber(row.unpaid_rows),
  payoutReadyArtists: toNumber(row.payout_ready_artists),
});

const getSummaryQuery = async (client, filters) => {
  const result = await client.query(
    `
    SELECT
      COALESCE(SUM(COALESCE(cr.gross_revenue, rr.revenue)), 0) AS gross_revenue,
      COALESCE(SUM(cr.net_revenue), 0) AS net_revenue,
      COALESCE(SUM(cr.artist_share), 0) AS artist_share,
      COALESCE(SUM(cr.label_share), 0) AS label_share,
      COALESCE(SUM(cr.company_share), 0) AS company_share,
      COALESCE(SUM(cr.gst_deduction), 0) AS gst_deduction,
      COALESCE(SUM(cr.tds_deduction), 0) AS tds_deduction,
      COALESCE(SUM(cr.payable_amount), 0) AS payable_balance,
      COALESCE(SUM(cr.paid_amount), 0) AS paid_amount,
      COALESCE(SUM(cr.pending_amount), 0) AS pending_amount,
      COALESCE(SUM(rr.streams), 0) AS total_streams,
      COUNT(DISTINCT rr.isrc) AS total_tracks,
      COUNT(*) FILTER (WHERE COALESCE(cr.payout_status, cr.finance_status) = 'paid') AS paid_rows,
      COUNT(*) FILTER (WHERE COALESCE(cr.payout_status, cr.finance_status, 'unpaid') <> 'paid') AS unpaid_rows,
      COUNT(DISTINCT cr.artist_id) FILTER (WHERE COALESCE(cr.pending_amount, 0) > 0 AND cr.artist_id IS NOT NULL) AS payout_ready_artists
    ${financeFrom}
    ${filters.where}
    `,
    filters.values
  );

  return mapSummary(result.rows[0]);
};

const getMonthlyTrend = async (client, filters) => {
  const result = await client.query(
    `
    SELECT
      TO_CHAR(rr.report_month, 'YYYY-MM') AS month,
      COALESCE(SUM(COALESCE(cr.gross_revenue, rr.revenue)), 0) AS gross_revenue,
      COALESCE(SUM(cr.net_revenue), 0) AS net_revenue,
      COALESCE(SUM(cr.artist_share), 0) AS artist_share,
      COALESCE(SUM(cr.label_share), 0) AS label_share,
      COALESCE(SUM(cr.company_share), 0) AS company_share,
      COALESCE(SUM(cr.payable_amount), 0) AS payable_amount,
      COALESCE(SUM(cr.paid_amount), 0) AS paid_amount,
      COALESCE(SUM(cr.pending_amount), 0) AS pending_amount,
      COALESCE(SUM(rr.streams), 0) AS streams
    ${financeFrom}
    ${filters.where}
    GROUP BY rr.report_month
    ORDER BY rr.report_month ASC
    LIMIT 24
    `,
    filters.values
  );

  return result.rows.map((row) => ({
    month: row.month,
    grossRevenue: toNumber(row.gross_revenue),
    netRevenue: toNumber(row.net_revenue),
    artistShare: toNumber(row.artist_share),
    labelShare: toNumber(row.label_share),
    companyShare: toNumber(row.company_share),
    payableAmount: toNumber(row.payable_amount),
    paidAmount: toNumber(row.paid_amount),
    pendingAmount: toNumber(row.pending_amount),
    streams: toNumber(row.streams),
  }));
};

const getGroupedBreakdown = async (client, filters, group) => {
  const groups = {
    artists: {
      key: "COALESCE(a.artist_name, rr.artist_name, 'Unknown artist')",
      id: "cr.artist_id",
      label: "artist",
    },
    labels: {
      key: "COALESCE(l.label_name, 'Unassigned label')",
      id: "cr.label_id",
      label: "label",
    },
    platforms: {
      key: "COALESCE(rr.platform, 'Others')",
      id: "NULL",
      label: "platform",
    },
    countries: {
      key: "COALESCE(rr.country, 'ZZ')",
      id: "NULL",
      label: "country",
    },
    tracks: {
      key: "COALESCE(t.title, t.song_name, rr.track_title, rr.track_name, 'Untitled track')",
      id: "cr.track_id",
      label: "track",
    },
  };
  const selected = groups[group];
  const groupBy = selected.id === "NULL" ? selected.key : `${selected.id}, ${selected.key}`;

  const result = await client.query(
    `
    SELECT
      ${selected.id} AS id,
      ${selected.key} AS name,
      COALESCE(SUM(COALESCE(cr.gross_revenue, rr.revenue)), 0) AS gross_revenue,
      COALESCE(SUM(cr.net_revenue), 0) AS net_revenue,
      COALESCE(SUM(cr.artist_share), 0) AS artist_share,
      COALESCE(SUM(cr.label_share), 0) AS label_share,
      COALESCE(SUM(cr.company_share), 0) AS company_share,
      COALESCE(SUM(cr.payable_amount), 0) AS payable_amount,
      COALESCE(SUM(cr.pending_amount), 0) AS pending_amount,
      COALESCE(SUM(rr.streams), 0) AS streams,
      COUNT(*) AS rows_count
    ${financeFrom}
    ${filters.where}
    GROUP BY ${groupBy}
    ORDER BY gross_revenue DESC
    LIMIT 20
    `,
    filters.values
  );

  return result.rows.map((row) => ({
    type: selected.label,
    id: row.id,
    name: row.name,
    grossRevenue: toNumber(row.gross_revenue),
    netRevenue: toNumber(row.net_revenue),
    artistShare: toNumber(row.artist_share),
    labelShare: toNumber(row.label_share),
    companyShare: toNumber(row.company_share),
    payableAmount: toNumber(row.payable_amount),
    pendingAmount: toNumber(row.pending_amount),
    streams: toNumber(row.streams),
    rowsCount: toNumber(row.rows_count),
  }));
};

const getFinanceSummary = async ({ user, query = {}, forcedArtistId, forcedLabelId } = {}) => {
  await ensureFinanceSchema();
  const client = await pool.connect();

  try {
    const filters = await buildFinanceFilters(client, { user, query, forcedArtistId, forcedLabelId });
    const [summary, monthlyTrend, artistBreakdown, labelBreakdown, platformBreakdown, countryBreakdown, trackBreakdown] =
      await Promise.all([
        getSummaryQuery(client, filters),
        getMonthlyTrend(client, filters),
        getGroupedBreakdown(client, filters, "artists"),
        getGroupedBreakdown(client, filters, "labels"),
        getGroupedBreakdown(client, filters, "platforms"),
        getGroupedBreakdown(client, filters, "countries"),
        getGroupedBreakdown(client, filters, "tracks"),
      ]);

    return {
      summary,
      monthlyTrend,
      artistBreakdown,
      labelBreakdown,
      platformBreakdown,
      countryBreakdown,
      trackBreakdown,
      pendingPayables: artistBreakdown.filter((item) => item.pendingAmount > 0),
      taxSummary: {
        gstDeduction: summary.gstDeduction,
        tdsDeduction: summary.tdsDeduction,
        totalDeductions: summary.gstDeduction + summary.tdsDeduction,
      },
    };
  } finally {
    client.release();
  }
};

const getArtistFinance = async ({ user, artistId, query = {} }) => {
  await ensureFinanceSchema();
  const client = await pool.connect();

  try {
    const resolvedArtistId = artistId === "me" ? await resolveOwnArtistId(client, user) : artistId;

    if (!resolvedArtistId || !(await canAccessArtist(client, user, resolvedArtistId))) {
      const error = new Error("You can only view finance assigned to your artist profile.");
      error.statusCode = 403;
      throw error;
    }

    return getFinanceSummary({ user, query, forcedArtistId: resolvedArtistId });
  } finally {
    client.release();
  }
};

const getLabelFinance = async ({ user, labelId, query = {} }) => {
  await ensureFinanceSchema();
  const client = await pool.connect();

  try {
    const resolvedLabelId = labelId === "me" ? await resolveOwnLabelId(client, user) : labelId;

    if (!resolvedLabelId || !(await canAccessLabel(client, user, resolvedLabelId))) {
      const error = new Error("You can only view finance assigned to your label profile.");
      error.statusCode = 403;
      throw error;
    }

    return getFinanceSummary({ user, query, forcedLabelId: resolvedLabelId });
  } finally {
    client.release();
  }
};

const getMonthlyFinance = async ({ user, query = {} }) => {
  const data = await getFinanceSummary({ user, query });
  return { monthlyTrend: data.monthlyTrend };
};

const recalculateFinance = async ({ user, reportMonth, importId }) =>
  recalculateRevenue({
    user,
    reportMonth,
    importId,
  });

const exportFinanceReport = async ({ user, query = {}, format = "xlsx", type = "artist" }) => {
  const data = await getFinanceSummary({ user, query });
  const source =
    {
      artist: data.artistBreakdown,
      label: data.labelBreakdown,
      platform: data.platformBreakdown,
      country: data.countryBreakdown,
      track: data.trackBreakdown,
      pending: data.pendingPayables,
      monthly: data.monthlyTrend,
      tax: [data.taxSummary],
    }[type] || data.artistBreakdown;
  const rows = source.slice(0, MAX_EXPORT_ROWS).map((item) => ({
    Name: item.name || item.month || type,
    Streams: item.streams || 0,
    "Gross Revenue": item.grossRevenue || 0,
    "Net Revenue": item.netRevenue || 0,
    "Artist Share": item.artistShare || 0,
    "Label Share": item.labelShare || 0,
    "Company Share": item.companyShare || 0,
    Payable: item.payableAmount || 0,
    Paid: item.paidAmount || 0,
    Pending: item.pendingAmount || 0,
    GST: item.gstDeduction || 0,
    TDS: item.tdsDeduction || 0,
  }));

  if (format === "csv") {
    const headers = Object.keys(rows[0] || { Name: "" });
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");

    return {
      contentType: "text/csv",
      extension: "csv",
      buffer: Buffer.from(csv),
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Finance Report");

  return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
};

module.exports = {
  canAccessArtist,
  canAccessLabel,
  exportFinanceReport,
  getArtistFinance,
  getFinanceSummary,
  getLabelFinance,
  getMonthlyFinance,
  recalculateFinance,
  resolveOwnArtistId,
  resolveOwnLabelId,
};
