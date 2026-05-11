module.exports = (row) => {
  return {
    isrc: row["ISRC"],
    upc: row["Asset ID"],
    track_name: row["Asset Title"],
    album_name: row["Album"],
    artist_name: row["Artist"],
    country: row["Country"],
    platform: "youtube",
    report_month: row["Month"],
    streams: parseInt(row["Views"] || 0),
    revenue: parseFloat(row["Revenue"] || 0),
    currency: row["Currency"] || "USD"
  };
};