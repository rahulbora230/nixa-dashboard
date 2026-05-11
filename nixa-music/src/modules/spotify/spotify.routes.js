const express = require('express');
const router = express.Router();

const getSpotifyToken = async () => {
  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log("Spotify raw token response:", text);
    throw new Error("Spotify token response is not JSON");
  }

  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Spotify token failed');
  }

  return data.access_token;
};

router.get('/artists/search', async (req, res) => {
  try {
    const q = req.query.q;

    if (!q) {
      return res.status(400).json({ error: 'Artist name required' });
    }

    const token = await getSpotifyToken();

    const spotifyRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=artist&limit=8`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const text = await spotifyRes.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.log("Spotify raw search response:", text);
      throw new Error("Spotify search response is not JSON");
    }

    if (!spotifyRes.ok) {
      throw new Error(data.error?.message || 'Spotify search failed');
    }

    const artists = data.artists.items.map((artist) => ({
      id: artist.id,
      name: artist.name,
      image: artist.images?.[0]?.url || null,
      followers: artist.followers?.total || 0,
      popularity: artist.popularity || 0,
      spotify_url: artist.external_urls?.spotify || null,
    }));

    res.json({ artists });
  } catch (err) {
    console.error('Spotify Artist Search Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;