import React from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./Dashboard.css";

const stats = [
  { title: "Total Revenue", value: "₹4,82,330", change: "+18.4%", icon: "₹" },
  { title: "This Month", value: "₹86,420", change: "+9.2%", icon: "↗" },
  { title: "Pending Payout", value: "₹1,24,500", change: "12 artists", icon: "⏳" },
  { title: "Total Tracks", value: "428", change: "+24 new", icon: "♪" },
  { title: "Artists", value: "76", change: "+6 active", icon: "👤" },
  { title: "Pending Approval", value: "14", change: "Need review", icon: "!" },
];

const uploads = [
  { song: "Xopunor Rati", artist: "Himadri Saikia", type: "Single", status: "Pending" },
  { song: "Tumi Mur", artist: "Rahul Bora", type: "Album", status: "Approved" },
  { song: "Boroxa", artist: "Nixa Music", type: "Single", status: "Distributed" },
];

const Dashboard = () => {
  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <Topbar title="Dashboard" subtitle="Music finance, revenue and catalog overview" />

        <section className="dashboard-hero">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h1>Good Evening, Rahul 👋</h1>
            <p>Nixa Music revenue increased by 18% this month.</p>
          </div>

          <button className="hero-btn">Upload Revenue CSV</button>
        </section>

        <section className="stats-grid">
          {stats.map((item, index) => (
            <div className="stat-card" key={index}>
              <div className="stat-top">
                <span className="stat-icon">{item.icon}</span>
                <span className="stat-change">{item.change}</span>
              </div>
              <h3>{item.value}</h3>
              <p>{item.title}</p>
            </div>
          ))}
        </section>

        <section className="dashboard-grid">
          <div className="panel revenue-panel">
            <div className="panel-header">
              <div>
                <h2>Revenue Overview</h2>
                <p>Monthly performance</p>
              </div>
              <select>
                <option>Last 6 Months</option>
                <option>Last 12 Months</option>
              </select>
            </div>

            <div className="fake-chart">
              <span style={{ height: "35%" }}></span>
              <span style={{ height: "55%" }}></span>
              <span style={{ height: "42%" }}></span>
              <span style={{ height: "70%" }}></span>
              <span style={{ height: "62%" }}></span>
              <span style={{ height: "90%" }}></span>
            </div>
          </div>

          <div className="panel">
            <h2>Platform Revenue</h2>
            <p>Breakdown by stores</p>

            <div className="platform-list">
              <div><span>Spotify</span><strong>₹2,10,400</strong></div>
              <div><span>YouTube</span><strong>₹1,22,800</strong></div>
              <div><span>Apple Music</span><strong>₹68,900</strong></div>
              <div><span>Others</span><strong>₹80,230</strong></div>
            </div>
          </div>
        </section>

        <section className="dashboard-grid bottom-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Recent Uploads</h2>
                <p>Latest catalog submissions</p>
              </div>
              <button className="small-btn">View All</button>
            </div>

            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Release</th>
                  <th>Artist</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {uploads.map((item, index) => (
                  <tr key={index}>
                    <td>{item.song}</td>
                    <td>{item.artist}</td>
                    <td>{item.type}</td>
                    <td>
                      <span className={`status ${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2>Quick Actions</h2>
            <p>Common admin tasks</p>

            <div className="quick-actions">
              <button>Create Release</button>
              <button>Add Artist</button>
              <button>Generate Payout</button>
              <button>Export Excel</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;