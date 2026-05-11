import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Percent, RefreshCw, TrendingUp, UploadCloud, UsersRound, WalletCards } from "lucide-react";
import RevenueStatCard from "../../components/revenue/RevenueStatCard";
import Toast from "../../components/ui/Toast";
import { financeService } from "../../services/financeService";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import "../finance/Finance.css";

const emptyData = {
  summary: {},
  monthlyTrend: [],
  artistBreakdown: [],
  trackBreakdown: [],
  pendingPayables: [],
};

const AdminDashboard = () => {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const result = await financeService.getFinanceSummary();
      setData({ ...emptyData, ...result });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load dashboard finance." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const stats = useMemo(
    () => [
      {
        title: "Gross Revenue",
        value: formatCurrency(data.summary.grossRevenue),
        caption: "All imported reports",
        tone: "cyan",
        icon: TrendingUp,
      },
      {
        title: "Payable Balance",
        value: formatCurrency(data.summary.payableBalance),
        caption: `${formatNumber(data.summary.payoutReadyArtists)} payout-ready artists`,
        tone: "purple",
        icon: WalletCards,
      },
      {
        title: "Company Share",
        value: formatCurrency(data.summary.companyShare),
        caption: "After split rules",
        tone: "magenta",
        icon: Percent,
      },
      {
        title: "Streams",
        value: formatNumber(data.summary.totalStreams),
        caption: "Matched royalty rows",
        tone: "green",
        icon: TrendingUp,
      },
    ],
    [data]
  );

  return (
    <div className="page-stack">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Admin Control</p>
          <h2>Revenue, releases, splits and finance in one command center.</h2>
          <p>Monitor the royalty engine from CSV ingestion through payable balances, split rules and exportable reports.</p>
        </div>
        <div className="hero-actions">
          <Link className="primary-button" to="/revenue/upload">
            <UploadCloud size={17} />
            Upload Revenue
          </Link>
          <Link className="secondary-button" to="/finance/splits">
            <Percent size={17} />
            Manage Splits
          </Link>
          <Link className="secondary-button" to="/payouts">
            <WalletCards size={17} />
            Payouts
          </Link>
          <Link className="secondary-button" to="/invoices">
            <Download size={17} />
            Invoices
          </Link>
          <Link className="secondary-button" to="/admin/users">
            <UsersRound size={17} />
            Users
          </Link>
        </div>
      </section>

      <section className="stats-grid four-columns">
        {loading ? Array.from({ length: 4 }).map((_, index) => <div className="metric-card skeleton" key={index} />) : stats.map((item) => <RevenueStatCard key={item.title} {...item} />)}
      </section>

      <section className="dashboard-grid">
        <article className="panel wide-panel">
          <div className="panel-heading">
            <div>
              <h3>Finance Trend</h3>
              <p>Gross revenue and payable movement</p>
            </div>
            <button className="secondary-button" type="button" onClick={loadDashboard}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          {data.monthlyTrend.length ? (
            <ResponsiveContainer width="100%" height={310}>
              <AreaChart data={data.monthlyTrend}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="month" stroke="#8392a7" tickLine={false} axisLine={false} />
                <YAxis stroke="#8392a7" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="grossRevenue" stroke="#10d7ff" fill="rgba(16,215,255,0.16)" strokeWidth={3} />
                <Area type="monotone" dataKey="payableAmount" stroke="#f43f9a" fill="rgba(244,63,154,0.08)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="finance-empty">Upload and recalculate revenue to unlock finance trends.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Pending Payables</h3>
              <p>Highest unpaid balances</p>
            </div>
          </div>
          <div className="mini-list">
            {data.pendingPayables.length ? data.pendingPayables.slice(0, 8).map((artist) => (
              <div className="mini-list-row" key={artist.id || artist.name}>
                <div>
                  <strong>{artist.name}</strong>
                  <span>{formatNumber(artist.streams)} streams</span>
                </div>
                <small>{formatCurrency(artist.pendingAmount)}</small>
              </div>
            )) : <div className="finance-empty">No pending payable balances.</div>}
          </div>
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel finance-table">
          <div className="panel-heading">
            <div>
              <h3>Top Artists</h3>
              <p>Revenue leaders from calculated finance</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artist</th>
                  <th>Streams</th>
                  <th>Gross</th>
                  <th>Payable</th>
                </tr>
              </thead>
              <tbody>
                {data.artistBreakdown.slice(0, 8).map((artist) => (
                  <tr key={artist.id || artist.name}>
                    <td>{artist.name}</td>
                    <td>{formatNumber(artist.streams)}</td>
                    <td>{formatCurrency(artist.grossRevenue)}</td>
                    <td>{formatCurrency(artist.payableAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Top Tracks</h3>
              <p>Track-wise gross revenue</p>
            </div>
          </div>
          <div className="mini-list">
            {data.trackBreakdown.slice(0, 8).map((track) => (
              <div className="mini-list-row" key={track.id || track.name}>
                <div>
                  <strong>{track.name}</strong>
                  <span>{formatNumber(track.streams)} streams</span>
                </div>
                <small>{formatCurrency(track.grossRevenue)}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default AdminDashboard;
