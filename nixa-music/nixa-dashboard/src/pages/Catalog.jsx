import React, { useEffect, useState } from "react";
import "./Catalog.css";
import { useNavigate } from "react-router-dom";

const Catalog = () => {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchCatalog = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/releases/list");
      const data = await res.json();

      if (data.success) {
        setReleases(data.releases);
      }
    } catch (error) {
      console.error("Catalog fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <div>
          <h1>Catalog</h1>
          <p>Submitted songs, albums and releases</p>
        </div>
      </div>

      {loading ? (
        <div className="empty-box">Loading catalog...</div>
      ) : releases.length === 0 ? (
        <div className="empty-box">No release submitted yet.</div>
      ) : (
        <div className="catalog-grid">
          {releases.map((item) => (
            <div className="catalog-card" key={item.id}>
              <div className="catalog-artwork">
                {item.artwork_url ? (
                  <img
                    src={`http://localhost:5000/${item.artwork_url.replace(/\\/g, "/")}`}
                    alt={item.album_name}
                  />
                ) : (
                  <span>No Artwork</span>
                )}
              </div>

              <div className="catalog-info">
                <h3>{item.album_name}</h3>
                <p>{item.label_name || "No Label"}</p>

                <div className="catalog-meta">
                  <span>{item.content_type}</span>
                  <span>{item.total_tracks} Track(s)</span>
                </div>

                <div className="catalog-meta">
                  <span>UPC: {item.upc || "N/A"}</span>
                </div>

                <div className="catalog-footer">
                  <span className={`status ${item.status?.toLowerCase()}`}>
                    {item.status || "Draft"}
                  </span>

                  <button onClick={() => navigate(`/catalog/${item.id}`)}>
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Catalog;