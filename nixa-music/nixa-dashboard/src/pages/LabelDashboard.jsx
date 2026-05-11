import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileText, Landmark, RefreshCw, UploadCloud, UsersRound, WalletCards } from "lucide-react";
import RevenueStatCard from "../components/revenue/RevenueStatCard";
import Toast from "../components/ui/Toast";
import { financeService } from "../services/financeService";
import { formatCurrency, formatNumber } from "../utils/formatters";
import "./finance/Finance.css";

const emptyData = { summary: {}, artistBreakdown: [], trackBreakdown: [], platformBreakdown: [] };

const LabelDashboard = () => {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const result = await financeService.getLabelFinance("me");
      setData({ ...emptyData, ...result });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load label dashboard." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const stats = [
    { title: "Label Revenue", value: formatCurrency(data.summary.grossRevenue), caption: "Roster gross", tone: "cyan", icon: Landmark },
    { title: "Artist Earnings", value: formatCurrency(data.summary.artistShare), caption: "Roster share", tone: "purple", icon: UsersRound },
    { title: "Label Share", value: formatCurrency(data.summary.labelShare), caption: "Split allocation", tone: "magenta", icon: WalletCards },
    { title: "Pending", value: formatCurrency(data.summary.pendingAmount), caption: "Unpaid balance", tone: "green", icon: WalletCards },
  ];

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Label Workspace</p>
          <h2>Roster revenue, artist earnings and label statements.</h2>
          <p>Monitor label finance across artists, tracks and platforms.</p>
        </div>
        <div className="hero-actions">
          <Link className="primary-button" to="/label/submit-release">
            <UploadCloud size={17} />
            Submit Release
          </Link>
          <Link className="secondary-button" to="/label/payouts">
            <FileText size={17} />
            Statement
          </Link>
        </div>
      </section>

      <section className="stats-grid four-columns">
        {loading ? Array.from({ length: 4 }).map((_, index) => <div className="metric-card skeleton" key={index} />) : stats.map((item) => <RevenueStatCard key={item.title} {...item} />)}
      </section>

      <section className="finance-section-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Roster Revenue</h3>
              <p>Artist-wise gross revenue</p>
            </div>
            <button className="secondary-button" type="button" onClick={loadDashboard}>
              <RefreshCw size={16} />
              Refresh
            </button>
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
            <div className="finance-empty">No roster revenue yet.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Top Tracks</h3>
              <p>Label catalog leaders</p>
            </div>
          </div>
          <div className="mini-list">
            {data.trackBreakdown.length ? data.trackBreakdown.slice(0, 8).map((track) => (
              <div className="mini-list-row" key={track.id || track.name}>
                <div>
                  <strong>{track.name}</strong>
                  <span>{formatNumber(track.streams)} streams</span>
                </div>
                <small>{formatCurrency(track.grossRevenue)}</small>
              </div>
            )) : <div className="finance-empty">No label tracks yet.</div>}
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default LabelDashboard;
