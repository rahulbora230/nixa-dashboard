module.exports = (row) => {
  return {
    isrc: row["ISRC"],
    upc: row["UPC"],
    track_name: row["Track Name"],
    album_name: row["Album Name"],
    artist_name: row["Artist Name"],
    country: row["Country"],
    platform: "spotify",
    report_month: row["Report Month"],
    streams: parseInt(row["Streams"] || 0),
    revenue: parseFloat(row["Revenue"] || 0),
    currency: row["Currency"] || "USD"
  };
};