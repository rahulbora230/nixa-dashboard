import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, ListChecks, RefreshCw, WalletCards } from "lucide-react";
import RevenueStatCard from "../../components/revenue/RevenueStatCard";
import PayoutStatusBadge from "../../components/payouts/PayoutStatusBadge";
import Toast from "../../components/ui/Toast";
import { payoutService } from "../../services/payoutService";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import "./Payouts.css";

const emptyData = {
  summary: {},
  monthlyTrend: [],
  paidVsPending: [],
  artistRanking: [],
  artistSummary: [],
  labelSummary: [],
  recentActivity: [],
};

const colors = ["#10d7ff", "#f43f9a", "#a855f7", "#5eead4"];

const PayoutDashboard = () => {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const result = await payoutService.getDashboard();
      setData({ ...emptyData, ...result });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load payout dashboard." });
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
        title: "Payable Balance",
        value: formatCurrency(data.summary.totalPayableBalance),
        caption: "Statement-ready balances",
        tone: "cyan",
        icon: WalletCards,
      },
      {
        title: "Paid Amount",
        value: formatCurrency(data.summary.totalPaidAmount),
        caption: "Completed payouts",
        tone: "purple",
        icon: WalletCards,
      },
      {
        title: "Pending Payouts",
        value: formatCurrency(data.summary.pendingPayouts),
        caption: `${formatNumber(data.summary.upcomingPayouts)} upcoming items`,
        tone: "magenta",
        icon: ListChecks,
      },
      {
        title: "This Month",
        value: formatCurrency(data.summary.thisMonthPayouts),
        caption: "Current month payouts",
        tone: "green",
        icon: WalletCards,
      },
    ],
    [data]
  );

  return (
    <div className="page-stack payout-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Payout Dashboard</p>
          <h2>Royalty payout command center for artists, labels and accounting.</h2>
          <p>Track payable balances, paid vs pending amounts, monthly payout flow and recent payout activity.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadDashboard}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <Link className="primary-button" to="/payouts/queue">
            <ListChecks size={17} />
            Open Queue
          </Link>
          <button className="secondary-button" type="button" onClick={() => payoutService.exportPayouts("all", "xlsx")}>
            <Download size={17} />
            Export
          </button>
        </div>
      </section>

      <section className="stats-grid four-columns">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <div className="metric-card skeleton" key={index} />)
          : stats.map((item) => <RevenueStatCard key={item.title} {...item} />)}
      </section>

      <section className="payout-section-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Monthly Payout Trend</h3>
              <p>Completed and upcoming payout movement</p>
            </div>
          </div>
          {data.monthlyTrend.length ? (
            <ResponsiveContainer width="100%" height={310}>
              <AreaChart data={data.monthlyTrend}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="month" stroke="#8392a7" tickLine={false} axisLine={false} />
                <YAxis stroke="#8392a7" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="paidAmount" stroke="#10d7ff" fill="rgba(16,215,255,0.18)" strokeWidth={3} />
                <Area type="monotone" dataKey="pendingAmount" stroke="#f43f9a" fill="rgba(244,63,154,0.08)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="payout-empty">No payout trend yet. Process payouts to build monthly history.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Paid vs Pending</h3>
              <p>Payout balance split</p>
            </div>
          </div>
          {data.paidVsPending.some((item) => item.value > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.paidVsPending} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={4}>
                  {data.paidVsPending.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="payout-empty">No paid or pending payout data yet.</div>
          )}
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Artist Payout Ranking</h3>
              <p>Highest pending artist balances</p>
            </div>
          </div>
          {data.artistRanking.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.artistRanking.slice(0, 8)} layout="vertical">
                <CartesianGrid stroke="rgba(255,255,255,0.07)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="recipientName" type="category" stroke="#8392a7" width={120} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="pendingAmount" fill="#a855f7" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="payout-empty">No artist payout ranking yet.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent Payout Activity</h3>
              <p>Latest payout queue events</p>
            </div>
          </div>
          <div className="payout-mini-list">
            {data.recentActivity.length ? (
              data.recentActivity.slice(0, 8).map((payout) => (
                <div className="payout-mini-row" key={payout.id || payout.queueId}>
                  <div>
                    <strong>{payout.recipientName}</strong>
                    <span>{payout.recipientType}</span>
                  </div>
                  <div>
                    <small>{formatCurrency(payout.netAmount || payout.pendingAmount)}</small>
                    <PayoutStatusBadge status={payout.status} />
                  </div>
                </div>
              ))
            ) : (
              <div className="payout-empty">No recent payout activity.</div>
            )}
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default PayoutDashboard;
