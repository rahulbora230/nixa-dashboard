import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Landmark, RefreshCw, Search, WalletCards } from "lucide-react";
import RevenueStatCard from "../../components/revenue/RevenueStatCard";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { financeService } from "../../services/financeService";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import "./Finance.css";

const emptyData = { summary: {}, monthlyTrend: [], artistBreakdown: [], trackBreakdown: [], platformBreakdown: [] };

const LabelFinance = () => {
  const { role } = useAuth();
  const [labelId, setLabelId] = useState(role === "label" ? "me" : "");
  const [filters, setFilters] = useState({ reportMonth: "", platform: "" });
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadFinance = useCallback(async () => {
    if (role !== "label" && !labelId.trim()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await financeService.getLabelFinance(labelId || "me", filters);
      setData({ ...emptyData, ...result });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load label finance." });
    } finally {
      setLoading(false);
    }
  }, [filters, labelId, role]);

  useEffect(() => {
    const timer = window.setTimeout(loadFinance, 0);
    return () => window.clearTimeout(timer);
  }, [loadFinance]);

  const stats = [
    { title: "Label Revenue", value: formatCurrency(data.summary.grossRevenue), caption: "Roster gross", tone: "cyan", icon: Landmark },
    { title: "Label Share", value: formatCurrency(data.summary.labelShare), caption: "Configured split", tone: "purple", icon: WalletCards },
    { title: "Artist Earnings", value: formatCurrency(data.summary.artistShare), caption: "Roster payable base", tone: "magenta", icon: WalletCards },
    { title: "Pending", value: formatCurrency(data.summary.pendingAmount), caption: "Unpaid balance", tone: "green", icon: WalletCards },
  ];

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Label Finance</p>
          <h2>Label revenue, roster earnings and split breakdown.</h2>
          <p>Track artist-wise, track-wise and platform-wise label finance in one view.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadFinance}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      <section className="statement-toolbar">
        {role !== "label" ? (
          <label className="finance-search span-2">
            <Search size={16} />
            <input value={labelId} onChange={(event) => setLabelId(event.target.value)} placeholder="Label UUID" />
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
              <h3>Artist-wise Breakdown</h3>
              <p>Roster revenue and payable share</p>
            </div>
          </div>
          {data.artistBreakdown.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.artistBreakdown.slice(0, 8)} layout="vertical">
                <CartesianGrid stroke="rgba(255,255,255,0.07)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#8392a7" width={120} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="grossRevenue" fill="#10d7ff" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="finance-empty">No label artist breakdown available.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Platform Breakdown</h3>
              <p>Label revenue by DSP</p>
            </div>
          </div>
          <div className="mini-list">
            {data.platformBreakdown.length ? data.platformBreakdown.slice(0, 8).map((platform) => (
              <div className="mini-list-row" key={platform.name}>
                <div>
                  <strong>{platform.name}</strong>
                  <span>{formatNumber(platform.streams)} streams</span>
                </div>
                <small>{formatCurrency(platform.grossRevenue)}</small>
              </div>
            )) : <div className="finance-empty">No platform revenue yet.</div>}
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
                <th>Label Share</th>
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
                  <td>{formatCurrency(track.labelShare)}</td>
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

export default LabelFinance;
