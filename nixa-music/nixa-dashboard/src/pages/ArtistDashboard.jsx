import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Disc3, FileText, RefreshCw, UploadCloud, WalletCards } from "lucide-react";
import RevenueStatCard from "../components/revenue/RevenueStatCard";
import Toast from "../components/ui/Toast";
import { financeService } from "../services/financeService";
import { formatCurrency, formatNumber } from "../utils/formatters";
import "./finance/Finance.css";

const emptyData = { summary: {}, monthlyTrend: [], trackBreakdown: [], platformBreakdown: [] };

const ArtistDashboard = () => {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const result = await financeService.getArtistFinance("me");
      setData({ ...emptyData, ...result });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load artist dashboard." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const stats = [
    { title: "My Earnings", value: formatCurrency(data.summary.artistShare), caption: "Artist share", tone: "cyan", icon: WalletCards },
    { title: "Payable", value: formatCurrency(data.summary.payableBalance), caption: "After deductions", tone: "purple", icon: WalletCards },
    { title: "Streams", value: formatNumber(data.summary.totalStreams), caption: "Matched plays", tone: "magenta", icon: Disc3 },
    { title: "Pending", value: formatCurrency(data.summary.pendingAmount), caption: "Unpaid balance", tone: "green", icon: WalletCards },
  ];

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Artist Workspace</p>
          <h2>Your earnings, streams, statements and payout-ready balance.</h2>
          <p>Track your catalog finance from revenue import to payable statement.</p>
        </div>
        <div className="hero-actions">
          <Link className="primary-button" to="/artist/submit-release">
            <UploadCloud size={17} />
            Submit Release
          </Link>
          <Link className="secondary-button" to="/artist/payouts">
            <FileText size={17} />
            Payouts
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
              <h3>Monthly Earnings</h3>
              <p>Artist share and payable trend</p>
            </div>
            <button className="secondary-button" type="button" onClick={loadDashboard}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          {data.monthlyTrend.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.monthlyTrend}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="month" stroke="#8392a7" tickLine={false} axisLine={false} />
                <YAxis stroke="#8392a7" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="artistShare" stroke="#10d7ff" fill="rgba(16,215,255,0.18)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="finance-empty">No artist finance trend yet.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Top Tracks</h3>
              <p>Your highest earning tracks</p>
            </div>
          </div>
          <div className="mini-list">
            {data.trackBreakdown.length ? data.trackBreakdown.slice(0, 8).map((track) => (
              <div className="mini-list-row" key={track.id || track.name}>
                <div>
                  <strong>{track.name}</strong>
                  <span>{formatNumber(track.streams)} streams</span>
                </div>
                <small>{formatCurrency(track.artistShare)}</small>
              </div>
            )) : <div className="finance-empty">No matched tracks yet.</div>}
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default ArtistDashboard;
