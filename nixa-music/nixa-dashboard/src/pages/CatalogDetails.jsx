import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import WaveSurfer from "wavesurfer.js";
import "./CatalogDetails.css";

const CatalogDetails = () => {
  const { id } = useParams();

  const [release, setRelease] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDetails = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/releases/${id}`);
      const data = await res.json();

      if (data.success) {
        setRelease(data.release);
        setTracks(data.tracks);
      }
    } catch (error) {
      console.error("Release detail fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  if (loading) {
    return <div className="details-page">Loading release...</div>;
  }

  if (!release) {
    return <div className="details-page">Release not found.</div>;
  }

  return (
    <div className="details-page">
      <div className="details-header">
        <div>
          <h1>{release.album_name}</h1>
          <p>{release.content_type || "Release"} · {release.status}</p>
        </div>

        <div className="status-badge">{release.status}</div>
      </div>

      <div className="details-layout">
        <div className="details-left">
          <div className="details-artwork">
            {release.artwork_url ? (
              <img
                src={`http://localhost:5000/${release.artwork_url.replace(/\\/g, "/")}`}
                alt={release.album_name}
              />
            ) : (
              <span>No Artwork</span>
            )}
          </div>

          <div className="release-meta-card">
            <p><b>Type:</b> {release.content_type || "N/A"}</p>
            <p><b>Status:</b> {release.status || "N/A"}</p>
            <p><b>Tracks:</b> {tracks.length}</p>
            <p>
              <b>Created:</b>{" "}
              {release.created_at
                ? new Date(release.created_at).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
        </div>

        <div className="details-right">
          <h2>Tracks</h2>

          {tracks.length === 0 ? (
            <div className="empty-track-box">No tracks found.</div>
          ) : (
            <div className="details-track-list">
              {tracks.map((track, index) => (
                <TrackDetailCard key={track.id} track={track} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TrackDetailCard = ({ track, index }) => {
  const audioUrl = track.audio_url
    ? `http://localhost:5000/${track.audio_url.replace(/\\/g, "/")}`
    : "";

  return (
    <div className="details-track-card">
      <div className="track-number">{index + 1}</div>

      <div className="track-main">
        <h3>{track.song_name}</h3>

        <p>
          {track.singer_name || "Unknown Artist"} · {track.category || "Original"} ·{" "}
          {track.isrc || "No ISRC"}
        </p>

        {audioUrl && <WaveformPlayer url={audioUrl} />}

        <div className="track-tags">
          <span>{track.language || "No Language"}</span>
          <span>{track.genre || "No Genre"}</span>
          <span>{track.mood || "No Mood"}</span>
          <span>{track.is_explicit ? "Explicit" : "Clean"}</span>
        </div>

        <div className="track-credits">
          <p><b>Lyricist:</b> {track.lyricist || "N/A"}</p>
          <p><b>Composer:</b> {track.composer || "N/A"}</p>
          <p><b>Producer:</b> {track.producer || "N/A"}</p>
          <p><b>Owner:</b> {track.owner_type || "N/A"}</p>
        </div>
      </div>
    </div>
  );
};

const WaveformPlayer = ({ url }) => {
  const containerRef = useRef(null);
  const waveRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    waveRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#62748e",
      progressColor: "#00ffaa",
      cursorColor: "#ffffff",
      height: 64,
      barWidth: 2,
      barGap: 2,
      responsive: true,
    });

    waveRef.current.load(url);

    return () => {
      if (waveRef.current) waveRef.current.destroy();
    };
  }, [url]);

  const togglePlay = () => {
    if (!waveRef.current) return;
    waveRef.current.playPause();
    setPlaying(!playing);
  };

  return (
    <div className="details-waveform">
      <button onClick={togglePlay}>{playing ? "Pause" : "Play"}</button>
      <div ref={containerRef} className="waveform-box" />
    </div>
  );
};

export default CatalogDetails;