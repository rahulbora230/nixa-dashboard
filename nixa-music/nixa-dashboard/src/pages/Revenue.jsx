import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const Revenue = () => {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState("");
  const [platform, setPlatform] = useState("");

  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/revenue");

if (!res.ok) {
  throw new Error("API failed");
}

const result = await res.json();
        setData(result);
        setFiltered(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRevenue();
  }, []);

  // FILTER LOGIC
  useEffect(() => {
    let temp = [...data];

    if (month) {
      temp = temp.filter((d) => d.report_month.startsWith(month));
    }

    if (platform) {
      temp = temp.filter((d) => d.platform === platform);
    }

    setFiltered(temp);
  }, [month, platform, data]);

  // SUMMARY
  const totalRevenue = filtered.reduce((sum, d) => sum + Number(d.revenue), 0);
  const totalStreams = filtered.reduce((sum, d) => sum + Number(d.streams), 0);

  if (loading) return <div style={{ color: "white" }}>Loading...</div>;

  return (
    <div style={{ display: "flex", background: "#0B0F14", color: "white", minHeight: "100vh" }}>
      
      <Sidebar />

      <div style={{ flex: 1 }}>
        <Topbar />

        <div style={{ padding: 20 }}>

          <h1>Revenue</h1>

          {/* Summary */}
          <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
            <div style={{ background: "#161C23", padding: 20, borderRadius: 12 }}>
              Total Revenue: ₹ {totalRevenue.toFixed(2)}
            </div>

            <div style={{ background: "#161C23", padding: 20, borderRadius: 12 }}>
              Total Streams: {totalStreams}
            </div>
          </div>

          {/* Filters */}
          <div style={{ marginTop: 30, display: "flex", gap: 20 }}>
            
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ padding: 10 }}
            />

            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              style={{ padding: 10 }}
            >
              <option value="">All Platforms</option>
              <option value="spotify">Spotify</option>
              <option value="apple">Apple Music</option>
              <option value="youtube">YouTube</option>
            </select>

          </div>

          {/* Table */}
          <div style={{ marginTop: 30, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              
              <thead>
                <tr style={{ background: "#11161D" }}>
                  <th style={th}>Track</th>
                  <th style={th}>Artist</th>
                  <th style={th}>Platform</th>
                  <th style={th}>Country</th>
                  <th style={th}>Month</th>
                  <th style={th}>Streams</th>
                  <th style={th}>Revenue</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                    <td style={td}>{r.track_name}</td>
                    <td style={td}>{r.artist_name}</td>
                    <td style={td}>{r.platform}</td>
                    <td style={td}>{r.country}</td>
                    <td style={td}>{r.report_month}</td>
                    <td style={td}>{r.streams}</td>
                    <td style={td}>₹ {r.revenue}</td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>

        </div>
      </div>
    </div>
  );
};

const th = {
  padding: 10,
  textAlign: "left",
  color: "#aaa"
};

const td = {
  padding: 10
};

export default Revenue;