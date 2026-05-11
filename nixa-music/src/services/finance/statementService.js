const XLSX = require("xlsx");
const pool = require("../../config/db");
const { getArtistFinance, getLabelFinance, resolveOwnArtistId, resolveOwnLabelId } = require("./financeService");
const { ensureFinanceSchema } = require("./financeSchema");

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getArtistName = async (artistId) => {
  if (!artistId || artistId === "me") {
    return "Artist";
  }

  const result = await pool.query("SELECT artist_name FROM artists WHERE id = $1", [artistId]);
  return result.rows[0]?.artist_name || "Artist";
};

const getLabelName = async (labelId) => {
  if (!labelId || labelId === "me") {
    return "Label";
  }

  const result = await pool.query("SELECT label_name FROM labels WHERE id = $1", [labelId]);
  return result.rows[0]?.label_name || "Label";
};

const getPeriod = (query = {}) => {
  if (query.reportMonth || query.report_month) {
    return query.reportMonth || query.report_month;
  }

  const from = query.from || query.fromMonth || query.from_month;
  const to = query.to || query.toMonth || query.to_month;

  if (from || to) {
    return `${from || "Start"} to ${to || "Now"}`;
  }

  return "All periods";
};

const getArtistStatement = async ({ user, artistId, query = {} }) => {
  await ensureFinanceSchema();
  const client = await pool.connect();

  try {
    const resolvedArtistId = artistId === "me" ? await resolveOwnArtistId(client, user) : artistId;
    const [name, finance] = await Promise.all([
      getArtistName(resolvedArtistId),
      getArtistFinance({ user, artistId: resolvedArtistId, query }),
    ]);

    return {
      type: "artist",
      artistId: resolvedArtistId,
      artistName: name,
      period: getPeriod(query),
      summary: finance.summary,
      trackBreakdown: finance.trackBreakdown,
      platformBreakdown: finance.platformBreakdown,
      monthlyTrend: finance.monthlyTrend,
    };
  } finally {
    client.release();
  }
};

const getLabelStatement = async ({ user, labelId, query = {} }) => {
  await ensureFinanceSchema();
  const client = await pool.connect();

  try {
    const resolvedLabelId = labelId === "me" ? await resolveOwnLabelId(client, user) : labelId;
    const [name, finance] = await Promise.all([
      getLabelName(resolvedLabelId),
      getLabelFinance({ user, labelId: resolvedLabelId, query }),
    ]);

    return {
      type: "label",
      labelId: resolvedLabelId,
      labelName: name,
      period: getPeriod(query),
      summary: finance.summary,
      artistBreakdown: finance.artistBreakdown,
      trackBreakdown: finance.trackBreakdown,
      platformBreakdown: finance.platformBreakdown,
      monthlyTrend: finance.monthlyTrend,
    };
  } finally {
    client.release();
  }
};

const rowsForStatement = (statement) => {
  const owner = statement.artistName || statement.labelName || "Statement";
  const summaryRows = [
    { Section: "Summary", Name: owner, Metric: "Period", Value: statement.period },
    { Section: "Summary", Name: owner, Metric: "Total Streams", Value: statement.summary.totalStreams },
    { Section: "Summary", Name: owner, Metric: "Gross Revenue", Value: statement.summary.grossRevenue },
    { Section: "Summary", Name: owner, Metric: "Net Revenue", Value: statement.summary.netRevenue },
    { Section: "Summary", Name: owner, Metric: "Artist Share", Value: statement.summary.artistShare },
    { Section: "Summary", Name: owner, Metric: "Label Share", Value: statement.summary.labelShare },
    { Section: "Summary", Name: owner, Metric: "Company Share", Value: statement.summary.companyShare },
    { Section: "Summary", Name: owner, Metric: "GST Deduction", Value: statement.summary.gstDeduction },
    { Section: "Summary", Name: owner, Metric: "TDS Deduction", Value: statement.summary.tdsDeduction },
    { Section: "Summary", Name: owner, Metric: "Paid Amount", Value: statement.summary.paidAmount },
    { Section: "Summary", Name: owner, Metric: "Pending Amount", Value: statement.summary.pendingAmount },
  ];

  const trackRows = (statement.trackBreakdown || []).map((track) => ({
    Section: "Tracks",
    Name: track.name,
    Streams: track.streams,
    "Gross Revenue": track.grossRevenue,
    "Net Revenue": track.netRevenue,
    Payable: track.payableAmount,
    Pending: track.pendingAmount,
  }));

  const platformRows = (statement.platformBreakdown || []).map((platform) => ({
    Section: "Platforms",
    Name: platform.name,
    Streams: platform.streams,
    "Gross Revenue": platform.grossRevenue,
    "Net Revenue": platform.netRevenue,
    Payable: platform.payableAmount,
    Pending: platform.pendingAmount,
  }));

  const artistRows = (statement.artistBreakdown || []).map((artist) => ({
    Section: "Artists",
    Name: artist.name,
    Streams: artist.streams,
    "Gross Revenue": artist.grossRevenue,
    "Net Revenue": artist.netRevenue,
    "Artist Share": artist.artistShare,
    Payable: artist.payableAmount,
    Pending: artist.pendingAmount,
  }));

  return [...summaryRows, ...trackRows, ...platformRows, ...artistRows];
};

const exportStatementExcel = (statement) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rowsForStatement(statement)), "Statement");

  return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
};

const pdfEscape = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const createSimplePdf = (lines) => {
  const content = [
    "BT",
    "/F1 12 Tf",
    "50 790 Td",
    "16 TL",
    ...lines.slice(0, 44).map((line, index) => `${index === 0 ? "" : "T* "}${`(${pdfEscape(line)}) Tj`}`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf);
};

const exportStatementPdf = (statement) => {
  const owner = statement.artistName || statement.labelName || "Statement";
  const lines = [
    `Nixa Music ${statement.type === "artist" ? "Artist" : "Label"} Statement`,
    `Name: ${owner}`,
    `Period: ${statement.period}`,
    `Total streams: ${toNumber(statement.summary.totalStreams).toLocaleString("en-IN")}`,
    `Gross revenue: INR ${toNumber(statement.summary.grossRevenue).toLocaleString("en-IN")}`,
    `Net revenue: INR ${toNumber(statement.summary.netRevenue).toLocaleString("en-IN")}`,
    `Artist share: INR ${toNumber(statement.summary.artistShare).toLocaleString("en-IN")}`,
    `Label share: INR ${toNumber(statement.summary.labelShare).toLocaleString("en-IN")}`,
    `Deductions: INR ${toNumber(statement.summary.gstDeduction + statement.summary.tdsDeduction).toLocaleString("en-IN")}`,
    `Paid: INR ${toNumber(statement.summary.paidAmount).toLocaleString("en-IN")}`,
    `Pending: INR ${toNumber(statement.summary.pendingAmount).toLocaleString("en-IN")}`,
    "",
    "Top tracks",
    ...(statement.trackBreakdown || []).slice(0, 12).map((track) => `${track.name}: INR ${toNumber(track.grossRevenue).toLocaleString("en-IN")}`),
  ];

  return {
    contentType: "application/pdf",
    extension: "pdf",
    buffer: createSimplePdf(lines),
  };
};

module.exports = {
  exportStatementExcel,
  exportStatementPdf,
  getArtistStatement,
  getLabelStatement,
};
