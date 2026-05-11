const spotifyParser = require('./spotify.parser');
const appleParser = require('./apple.parser');
const youtubeParser = require('./youtube.parser');

const detectPlatform = (row) => {
  if (row["Track Name"] && row["Streams"]) return "spotify";
  if (row["Song Title"] && row["Units"]) return "apple";
  if (row["Asset Title"] && row["Views"]) return "youtube";

  return "unknown";
};

const getParser = (platform) => {
  switch (platform) {
    case "spotify":
      return spotifyParser;
    case "apple":
      return appleParser;
    case "youtube":
      return youtubeParser;
    default:
      return null;
  }
};

module.exports = { detectPlatform, getParser };