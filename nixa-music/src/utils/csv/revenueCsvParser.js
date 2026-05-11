const fs = require("fs");
const csv = require("csv-parser");

const headerAliases = {
  spotify_isrc: "isrc",
  track_isrc: "isrc",
  song_isrc: "isrc",
  isrc_code: "isrc",
  recording_isrc: "isrc",
  product_upc: "upc",
  release_upc: "upc",
  track_name: "track_title",
  track_title: "track_title",
  song_title: "track_title",
  asset_title: "track_title",
  content_title: "track_title",
  recording_title: "track_title",
  title: "track_title",
  artist: "artist_name",
  artist_name: "artist_name",
  primary_artist: "artist_name",
  artists: "artist_name",
  performer: "artist_name",
  stream_count: "streams",
  streams: "streams",
  quantity: "streams",
  units: "streams",
  views: "streams",
  plays: "streams",
  revenue: "revenue",
  net_revenue: "revenue",
  gross_revenue: "revenue",
  earnings: "revenue",
  amount: "revenue",
  payable: "revenue",
  royalty: "revenue",
  country: "country",
  territory: "country",
  country_code: "country",
  market: "country",
  platform: "platform",
  dsp: "platform",
  store: "platform",
  service: "platform",
  source: "platform",
  report_month: "report_month",
  reporting_month: "report_month",
  sales_month: "report_month",
  month: "report_month",
  period: "report_month",
  statement_month: "report_month",
  currency: "currency",
  currency_code: "currency",
};

const platformAliases = {
  spotify: "Spotify",
  "spotify music": "Spotify",
  apple: "Apple Music",
  "apple music": "Apple Music",
  itunes: "Apple Music",
  youtube: "YouTube",
  "youtube music": "YouTube",
  meta: "Meta",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  tik_tok: "TikTok",
  amazon: "Amazon Music",
  "amazon music": "Amazon Music",
  jiosaavn: "JioSaavn",
  "jio saavn": "JioSaavn",
  wynk: "Wynk",
  boomplay: "Boomplay",
  resso: "Resso",
  others: "Others",
  other: "Others",
};

const normalizeHeader = (header = "") => {
  const normalized = String(header)
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[%()]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return headerAliases[normalized] || normalized;
};

const cleanText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).replace(/\uFEFF/g, "").trim();
  return trimmed ? trimmed : null;
};

const cleanCurrency = (value, fallback = "INR") => {
  const text = cleanText(value || fallback);
  return (text || fallback).toUpperCase();
};

const canonicalPlatform = (value, fallback = "Others") => {
  const text = cleanText(value || fallback);

  if (!text) {
    return "Others";
  }

  return platformAliases[text.toLowerCase()] || text;
};

const parseInteger = (value) => {
  const text = cleanText(value);

  if (!text) {
    return 0;
  }

  const parsed = Number.parseInt(text.replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDecimal = (value) => {
  const text = cleanText(value);

  if (!text) {
    return 0;
  }

  const negative = /^\(.*\)$/.test(text);
  const parsed = Number.parseFloat(text.replace(/[(),\s]/g, "").replace(/[^0-9.-]/g, ""));

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return negative ? -Math.abs(parsed) : parsed;
};

const padMonth = (value) => String(value).padStart(2, "0");

const parseReportMonth = (value) => {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}$/.test(text)) {
    return `${text}-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return `${text.slice(0, 7)}-01`;
  }

  const dashMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (dashMatch) {
    const [, first, second, year] = dashMatch;
    const month = Number(first) > 12 ? second : second;
    return `${year}-${padMonth(month)}-01`;
  }

  const monthNameDate = new Date(text);

  if (!Number.isNaN(monthNameDate.getTime())) {
    return `${monthNameDate.getFullYear()}-${padMonth(monthNameDate.getMonth() + 1)}-01`;
  }

  return null;
};

const isEmptyRow = (row) =>
  Object.values(row).every((value) => value === undefined || value === null || String(value).trim() === "");

const parseCsvFile = (filePath) =>
  new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(
        csv({
          mapHeaders: ({ header }) => normalizeHeader(header),
          strict: false,
        })
      )
      .on("data", (row) => {
        if (!isEmptyRow(row)) {
          rows.push(row);
        }
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });

const normalizeRevenueRow = (row, defaults = {}, rowNumber = 0) => {
  const reportMonth = parseReportMonth(row.report_month || defaults.reportMonth);
  const platform = canonicalPlatform(row.platform, defaults.platform);
  const currency = cleanCurrency(row.currency, defaults.currency);

  return {
    rowNumber,
    isrc: cleanText(row.isrc)?.toUpperCase() || null,
    upc: cleanText(row.upc),
    trackTitle: cleanText(row.track_title),
    artistName: cleanText(row.artist_name),
    platform,
    country: cleanText(row.country) || "ZZ",
    streams: parseInteger(row.streams),
    revenue: parseDecimal(row.revenue),
    currency,
    reportMonth,
    rawData: row,
  };
};

const normalizeRevenueRows = (rows, defaults = {}) =>
  rows.map((row, index) => normalizeRevenueRow(row, defaults, index + 1));

module.exports = {
  canonicalPlatform,
  normalizeHeader,
  normalizeRevenueRows,
  parseCsvFile,
  parseReportMonth,
};
