import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw, Search } from "lucide-react";
import RevenueStatCard from "../../components/revenue/RevenueStatCard";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { financeService } from "../../services/financeService";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import "./Finance.css";

const emptyData = { summary: {}, monthlyTrend: [], trackBreakdown: [], platformBreakdown: [] };

const ArtistFinance = () => {
  const { role } = useAuth();
  const [artistId, setArtistId] = useState(role === "artist" ? "me" : "");
  const [filters, setFilters] = useState({ reportMonth: "", platform: "" });
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadFinance = useCallback(async () => {
    if (role !== "artist" && !artistId.trim()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await financeService.getArtistFinance(artistId || "me", filters);
      setData({ ...emptyData, ...result });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load artist finance." });
    } finally {
      setLoading(false);
    }
  }, [artistId, filters, role]);

  useEffect(() => {
    const timer = window.setTimeout(loadFinance, 0);
    return () => window.clearTimeout(timer);
  }, [loadFinance]);

  const stats = [
    { title: "Artist Share", value: formatCurrency(data.summary.artistShare), caption: "Before deductions", tone: "cyan", icon: RefreshCw },
    { title: "Payable", value: formatCurrency(data.summary.payableBalance), caption: "After GST and TDS", tone: "purple", icon: RefreshCw },
    { title: "Pending", value: formatCurrency(data.summary.pendingAmount), caption: "Unpaid balance", tone: "magenta", icon: RefreshCw },
    { title: "Streams", value: formatNumber(data.summary.totalStreams), caption: "Matched rows", tone: "green", icon: RefreshCw },
  ];

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Artist Finance</p>
          <h2>Artist earnings, payable balance and track-level breakdown.</h2>
          <p>Use monthly and platform filters to audit statement-ready artist finance.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadFinance}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      <section className="statement-toolbar">
        {role !== "artist" ? (
          <label className="finance-search span-2">
            <Search size={16} />
            <input value={artistId} onChange={(event) => setArtistId(event.target.value)} placeholder="Artist UUID" />
          </label>
        ) : null}
        <input type="month" value={filters.reportMonth} onChange={(event) => setFilters((current) => ({ ...current, reportMonth: event.target.value }))} />
        <input value={filters.platform} onChange={(event) => setFilters((current) => ({ ...current, platform: event.target.value }))} placeholder="Platform" />
      </section>

      <section className="stats-grid four-columns">
        {loading ? Array.from({ length: 4 }).map((_, index) => <div className="metric-card skeleton" key={index} />) : stats.map((item) => <RevenueStatCard key={item.title} {...item} />)}
      </section>

      <section className="finance-section-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Monthly Earnings</h3>
              <p>Artist share and payable trend</p>
            </div>
          </div>
          {data.monthlyTrend.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.monthlyTrend}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="month" stroke="#8392a7" tickLine={false} axisLine={false} />
                <YAxis stroke="#8392a7" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="artistShare" stroke="#10d7ff" fill="rgba(16,215,255,0.18)" strokeWidth={3} />
                <Area type="monotone" dataKey="payableAmount" stroke="#f43f9a" fill="rgba(244,63,154,0.08)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="finance-empty">No artist finance trend available.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Platform Earnings</h3>
              <p>Artist payable by DSP</p>
            </div>
          </div>
          <div className="mini-list">
            {data.platformBreakdown.length ? data.platformBreakdown.slice(0, 8).map((platform) => (
              <div className="mini-list-row" key={platform.name}>
                <div>
                  <strong>{platform.name}</strong>
                  <span>{formatNumber(platform.streams)} streams</span>
                </div>
                <small>{formatCurrency(platform.payableAmount)}</small>
              </div>
            )) : <div className="finance-empty">No platform earnings yet.</div>}
          </div>
        </article>
      </section>

      <section className="catalog-panel finance-table">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Track</th>
                <th>Streams</th>
                <th>Gross</th>
                <th>Artist Share</th>
                <th>Payable</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.trackBreakdown.map((track) => (
                <tr key={track.id || track.name}>
                  <td>{track.name}</td>
                  <td>{formatNumber(track.streams)}</td>
                  <td>{formatCurrency(track.grossRevenue)}</td>
                  <td>{formatCurrency(track.artistShare)}</td>
                  <td>{formatCurrency(track.payableAmount)}</td>
                  <td>{formatCurrency(track.pendingAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default ArtistFinance;
