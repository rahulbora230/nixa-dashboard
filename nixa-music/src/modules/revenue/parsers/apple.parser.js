module.exports = (row) => {
  return {
    isrc: row["ISRC"],
    upc: row["UPC"],
    track_name: row["Song Title"],
    album_name: row["Album Title"],
    artist_name: row["Artist"],
    country: row["Territory"],
    platform: "apple",
    report_month: row["Month"],
    streams: parseInt(row["Units"] || 0),
    revenue: parseFloat(row["Earnings"] || 0),
    currency: row["Currency"] || "USD"
  };
};