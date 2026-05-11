import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import Chart from "react-apexcharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Download,
  Filter,
  Globe2,
  Headphones,
  IndianRupee,
  Music2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import "./Analytics.css";

const API_URL = "http://localhost:5000/api/dashboard";

const Analytics = () => {
  const [data, setData] = useState({
    monthly: [],
    platforms: [],
    countries: [],
    topTracks: [],
    artists: [],
  });

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    platform: "",
    artist: "",
  });

  const [metric, setMetric] = useState("revenue");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      ).toString();

      const res = await fetch(`${API_URL}?${params}`);
      const result = await res.json();

      setData({
        monthly: result.monthly || [],
        platforms: result.platforms || [],
        countries: result.countries || [],
        topTracks: result.topTracks || [],
        artists: result.artists || [],
      });
    } catch (error) {
      console.error("Analytics fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalRevenue = useMemo(
    () => data.monthly.reduce((sum, item) => sum + Number(item.revenue || 0), 0),
    [data.monthly]
  );

  const totalStreams = useMemo(
    () => data.monthly.reduce((sum, item) => sum + Number(item.streams || 0), 0),
    [data.monthly]
  );

  const prevRevenue = Number(data.monthly[data.monthly.length - 2]?.revenue || 0);
  const currentRevenue = Number(data.monthly[data.monthly.length - 1]?.revenue || 0);

  const growth =
    prevRevenue > 0
      ? (((currentRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
      : "0.0";

  const rpm =
    totalStreams > 0 ? ((totalRevenue / totalStreams) * 1000).toFixed(2) : "0.00";

  const topTrack = data.topTracks?.[0]?.track_name || "No track";
  const topPlatform = data.platforms?.[0]?.platform || "No platform";
  const topCountry = data.countries?.[0]?.country || "No country";

  const mainSeries = [
    {
      name: metric === "revenue" ? "Revenue" : "Streams",
      data: data.monthly.map((item) =>
        metric === "revenue" ? Number(item.revenue || 0) : Number(item.streams || 0)
      ),
    },
  ];

  const mainChartOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
      background: "transparent",
      foreColor: "#cbd5e1",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    stroke: {
      curve: "smooth",
      width: 4,
      colors: ["#1ed760"],
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.45,
        opacityTo: 0.02,
        stops: [0, 85],
      },
    },
    grid: {
      borderColor: "rgba(255,255,255,0.08)",
      strokeDashArray: 4,
    },
    xaxis: {
      categories: data.monthly.map((item) => item.month),
      labels: { style: { colors: "#94a3b8" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#94a3b8" },
        formatter: (value) =>
          metric === "revenue"
            ? `₹${Number(value).toLocaleString()}`
            : Number(value).toLocaleString(),
      },
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: (value) =>
          metric === "revenue"
            ? `₹ ${Number(value).toLocaleString()}`
            : `${Number(value).toLocaleString()} streams`,
      },
    },
    colors: ["#1ed760"],
  };

  const platformOptions = {
    chart: {
      type: "donut",
      background: "transparent",
      foreColor: "#fff",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    labels: data.platforms.map((item) => item.platform || "Unknown"),
    colors: ["#1ed760", "#38bdf8", "#a855f7", "#f97316", "#f43f5e", "#eab308"],
    stroke: {
      colors: ["#111827"],
      width: 3,
    },
    legend: {
      position: "bottom",
      labels: { colors: "#cbd5e1" },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Revenue",
              color: "#94a3b8",
              formatter: () => `₹${totalRevenue.toLocaleString()}`,
            },
          },
        },
      },
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: (value) => `₹ ${Number(value).toLocaleString()}`,
      },
    },
  };

  const platformSeries = data.platforms.map((item) => Number(item.revenue || 0));

  const streamBarOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      background: "transparent",
      foreColor: "#cbd5e1",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: "42%",
      },
    },
    grid: {
      borderColor: "rgba(255,255,255,0.08)",
      strokeDashArray: 4,
    },
    xaxis: {
      categories: data.monthly.map((item) => item.month),
      labels: { style: { colors: "#94a3b8" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#94a3b8" },
        formatter: (value) => Number(value).toLocaleString(),
      },
    },
    colors: ["#38bdf8"],
    tooltip: {
      theme: "dark",
      y: {
        formatter: (value) => `${Number(value).toLocaleString()} streams`,
      },
    },
  };

  const streamBarSeries = [
    {
      name: "Streams",
      data: data.monthly.map((item) => Number(item.streams || 0)),
    },
  ];

  const handleDownload = () => {
    window.open("http://localhost:5000/api/dashboard/export", "_blank");
  };

  return (
    <div className="sfa-page">
      <Sidebar />

      <main className="sfa-main">
        <Topbar />

        <section className="sfa-content">
          <div className="sfa-hero">
            <div className="sfa-hero-left">
              <div className="sfa-badge">
                <Sparkles size={15} />
                Spotify for Artists Style
              </div>

              <h1>Nixa Music Analytics</h1>
              <p>
                Revenue, streams, platform split, countries, top songs and artist performance
                in one premium dashboard.
              </p>

              <div className="sfa-hero-actions">
                <button onClick={fetchData}>
                  <RefreshCw size={16} />
                  Refresh
                </button>

                <button className="secondary" onClick={handleDownload}>
                  <Download size={16} />
                  Export Excel
                </button>
              </div>
            </div>

            <div className="sfa-hero-stat">
              <span>Total Revenue</span>
              <h2>₹ {totalRevenue.toLocaleString()}</h2>

              <div className={Number(growth) >= 0 ? "growth up" : "growth down"}>
                {Number(growth) >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {growth}% this period
              </div>
            </div>
          </div>

          <div className="sfa-filter-card">
            <div className="filter-label">
              <Filter size={17} />
              Filters
            </div>

            <div className="input-box">
              <Calendar size={16} />
              <input
                type="month"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
            </div>

            <div className="input-box">
              <Calendar size={16} />
              <input
                type="month"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </div>

            <div className="input-box">
              <Music2 size={16} />
              <select
                value={filters.platform}
                onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
              >
                <option value="">All Platforms</option>
                <option value="spotify">Spotify</option>
                <option value="youtube">YouTube</option>
                <option value="apple">Apple Music</option>
                <option value="meta">Meta</option>
                <option value="resso">Resso</option>
              </select>
            </div>

            <div className="input-box">
              <Search size={16} />
              <input
                placeholder="Artist name"
                value={filters.artist}
                onChange={(e) => setFilters({ ...filters, artist: e.target.value })}
              />
            </div>

            <button onClick={fetchData}>Apply</button>
          </div>

          {loading ? (
            <div className="sfa-loading">Loading premium analytics...</div>
          ) : (
            <>
              <div className="sfa-kpi-grid">
                <Kpi icon={<IndianRupee />} label="Revenue" value={`₹ ${totalRevenue.toLocaleString()}`} />
                <Kpi icon={<Headphones />} label="Streams" value={totalStreams.toLocaleString()} />
                <Kpi icon={<TrendingUp />} label="Growth" value={`${growth}%`} />
                <Kpi icon={<Activity />} label="RPM" value={`₹ ${rpm}`} />
                <Kpi icon={<Music2 />} label="Top Platform" value={topPlatform} />
                <Kpi icon={<Globe2 />} label="Top Country" value={topCountry} />
              </div>

              <div className="sfa-grid-main">
                <div className="sfa-card wide">
                  <div className="sfa-card-head">
                    <div>
                      <h3>{metric === "revenue" ? "Revenue Growth" : "Stream Growth"}</h3>
                      <p>Monthwise performance trend</p>
                    </div>

                    <div className="metric-toggle">
                      <button
                        className={metric === "revenue" ? "active" : ""}
                        onClick={() => setMetric("revenue")}
                      >
                        Revenue
                      </button>
                      <button
                        className={metric === "streams" ? "active" : ""}
                        onClick={() => setMetric("streams")}
                      >
                        Streams
                      </button>
                    </div>
                  </div>

                  <Chart options={mainChartOptions} series={mainSeries} type="area" height={360} />
                </div>

                <div className="sfa-card">
                  <div className="sfa-card-head">
                    <div>
                      <h3>Platform Split</h3>
                      <p>Revenue by DSP</p>
                    </div>
                  </div>

                  {platformSeries.length > 0 ? (
                    <Chart options={platformOptions} series={platformSeries} type="donut" height={360} />
                  ) : (
                    <Empty text="No platform data" />
                  )}
                </div>
              </div>

              <div className="sfa-grid-main">
                <div className="sfa-card wide">
                  <div className="sfa-card-head">
                    <div>
                      <h3>Monthly Streams</h3>
                      <p>Track streaming movement</p>
                    </div>
                  </div>

                  <Chart options={streamBarOptions} series={streamBarSeries} type="bar" height={330} />
                </div>

                <div className="sfa-card insight-card">
                  <div className="sfa-card-head">
                    <div>
                      <h3>AI Insights</h3>
                      <p>Smart summary</p>
                    </div>
                  </div>

                  <div className="insight-list">
                    <Insight text={`Top performing song is "${topTrack}".`} />
                    <Insight text={`${topPlatform} is currently your strongest platform.`} />
                    <Insight text={`${topCountry} is leading country-wise performance.`} />
                    <Insight text={`Current estimated RPM is ₹${rpm}.`} />
                  </div>
                </div>
              </div>

              <div className="sfa-table-grid">
                <RankingCard title="Top Songs" icon={<BarChart3 />} data={data.topTracks} nameKey="track_name" />
                <RankingCard title="Top Artists" icon={<Users />} data={data.artists} nameKey="artist_name" />
                <RankingCard title="Top Platforms" icon={<Music2 />} data={data.platforms} nameKey="platform" />
                <RankingCard title="Top Countries" icon={<Globe2 />} data={data.countries} nameKey="country" />
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

const Kpi = ({ icon, label, value }) => (
  <div className="sfa-kpi">
    <div className="sfa-kpi-icon">{icon}</div>
    <div>
      <span>{label}</span>
      <h3>{value}</h3>
    </div>
  </div>
);

const RankingCard = ({ title, icon, data, nameKey }) => {
  const maxValue = Math.max(...data.map((item) => Number(item.revenue || item.streams || 0)), 1);

  return (
    <div className="sfa-card ranking-card">
      <div className="sfa-card-head">
        <div>
          <h3>
            {icon} {title}
          </h3>
          <p>Top performance</p>
        </div>
      </div>

      {data.length === 0 ? (
        <Empty text="No data available" />
      ) : (
        <div className="ranking-list">
          {data.slice(0, 7).map((item, index) => {
            const value = Number(item.revenue || item.streams || 0);
            const percent = Math.min((value / maxValue) * 100, 100);

            return (
              <div className="ranking-row" key={index}>
                <div className="rank-info">
                  <b>{index + 1}</b>
                  <div>
                    <span>{item[nameKey] || "Unknown"}</span>
                    <div className="progress">
                      <i style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </div>

                <strong>₹ {Number(item.revenue || 0).toLocaleString()}</strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Insight = ({ text }) => (
  <div className="insight-item">
    <Sparkles size={15} />
    <span>{text}</span>
  </div>
);

const Empty = ({ text }) => <div className="empty">{text}</div>;

export default Analytics;