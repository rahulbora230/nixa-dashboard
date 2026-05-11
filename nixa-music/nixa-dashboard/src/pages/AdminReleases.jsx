import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const AdminReleases = () => {
  const [releases, setReleases] = useState([]);
  const [tracks, setTracks] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchReleases = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/admin/releases");
      const data = await res.json();
      setReleases(data);
    } catch (err) {
      console.error("Admin releases error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTracks = async (releaseId) => {
    const res = await fetch(
      `http://localhost:5000/api/admin/releases/${releaseId}/tracks`
    );
    const data = await res.json();

    setTracks((prev) => ({
      ...prev,
      [releaseId]: data,
    }));
  };

  const approveRelease = async (id) => {
    await fetch(`http://localhost:5000/api/admin/releases/${id}/approve`, {
      method: "PATCH",
    });
    fetchReleases();
  };

  const rejectRelease = async (id) => {
    const note = prompt("Reject reason?");
    await fetch(`http://localhost:5000/api/admin/releases/${id}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    fetchReleases();
  };

  const downloadFile = (filePath) => {
    window.open(
      `http://localhost:5000/api/admin/download?path=${encodeURIComponent(
        filePath
      )}`,
      "_blank"
    );
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  if (loading) {
    return <div style={{ color: "white", padding: 20 }}>Loading...</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        background: "#0B0F14",
        minHeight: "100vh",
        color: "white",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1 }}>
        <Topbar />

        <div style={{ padding: 20 }}>
          <h1>Admin Releases</h1>

          {releases.length === 0 ? (
            <p>No releases found</p>
          ) : (
            releases.map((release) => (
              <div
                key={release.id}
                style={{
                  background: "#161C23",
                  padding: 20,
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <h2>{release.title}</h2>
                <p>Artist: {release.artist_name}</p>
                <p>Type: {release.type}</p>
                <p>Status: {release.status}</p>

                {release.admin_note && (
                  <p style={{ color: "#ff7777" }}>
                    Note: {release.admin_note}
                  </p>
                )}

                {release.artwork_url && (
                  <button onClick={() => downloadFile(release.artwork_url)}>
                    Download Artwork
                  </button>
                )}

                <button
                  style={{ marginLeft: 10 }}
                  onClick={() => fetchTracks(release.id)}
                >
                  View Tracks
                </button>

                <button
                  style={{ marginLeft: 10 }}
                  onClick={() => approveRelease(release.id)}
                >
                  Approve
                </button>

                <button
                  style={{ marginLeft: 10 }}
                  onClick={() => rejectRelease(release.id)}
                >
                  Reject
                </button>

                {tracks[release.id] && (
                  <div style={{ marginTop: 20 }}>
                    <h3>Tracks</h3>

                    {tracks[release.id].map((track) => (
                      <div
                        key={track.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          borderBottom: "1px solid #333",
                          padding: "10px 0",
                        }}
                      >
                        <span>
                          {track.title} — {track.isrc}
                        </span>

                        {track.audio_url && (
                          <button onClick={() => downloadFile(track.audio_url)}>
                            Download Audio
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminReleases;