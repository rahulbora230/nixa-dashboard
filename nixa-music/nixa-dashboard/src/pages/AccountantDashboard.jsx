import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileText, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import RevenueStatCard from "../components/revenue/RevenueStatCard";
import Toast from "../components/ui/Toast";
import { financeService } from "../services/financeService";
import { formatCurrency, formatNumber } from "../utils/formatters";
import "./finance/Finance.css";

const emptyData = { summary: {}, monthlyTrend: [], pendingPayables: [], taxSummary: {} };

const AccountantDashboard = () => {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const result = await financeService.getFinanceSummary();
      setData({ ...emptyData, ...result });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load accountant dashboard." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const stats = [
    { title: "Total Payable", value: formatCurrency(data.summary.payableBalance), caption: "Statement-ready", tone: "cyan", icon: WalletCards },
    { title: "Paid Amount", value: formatCurrency(data.summary.paidAmount), caption: "Recorded paid", tone: "purple", icon: ShieldCheck },
    { title: "Pending Amount", value: formatCurrency(data.summary.pendingAmount), caption: `${formatNumber(data.summary.payoutReadyArtists)} artists`, tone: "magenta", icon: WalletCards },
    { title: "GST / TDS", value: formatCurrency(data.taxSummary.totalDeductions), caption: "Deduction summary", tone: "green", icon: ShieldCheck },
  ];

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Accountant Workspace</p>
          <h2>Payout queue, tax deductions and finance reports.</h2>
          <p>Review paid vs unpaid revenue, GST/TDS summary and payout-ready artist balances.</p>
        </div>
        <div className="hero-actions">
          <Link className="primary-button" to="/accountant/payout-queue">
            <WalletCards size={17} />
            Payout Queue
          </Link>
          <Link className="secondary-button" to="/accountant/invoices">
            <FileText size={17} />
            Reports
          </Link>
          <button className="secondary-button" type="button" onClick={() => financeService.exportFinanceReport("pending", "xlsx")}>
            <Download size={17} />
            Export
          </button>
        </div>
      </section>

      <section className="stats-grid four-columns">
        {loading ? Array.from({ length: 4 }).map((_, index) => <div className="metric-card skeleton" key={index} />) : stats.map((item) => <RevenueStatCard key={item.title} {...item} />)}
      </section>

      <section className="finance-section-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Monthly Payout Trend</h3>
              <p>Payable and pending movement</p>
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
                <Area type="monotone" dataKey="payableAmount" stroke="#10d7ff" fill="rgba(16,215,255,0.18)" strokeWidth={3} />
                <Area type="monotone" dataKey="pendingAmount" stroke="#f43f9a" fill="rgba(244,63,154,0.08)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="finance-empty">No monthly payout trend yet.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Payout-ready Artists</h3>
              <p>Highest pending balances</p>
            </div>
          </div>
          <div className="mini-list">
            {data.pendingPayables.length ? data.pendingPayables.slice(0, 9).map((artist) => (
              <div className="mini-list-row" key={artist.id || artist.name}>
                <div>
                  <strong>{artist.name}</strong>
                  <span>{formatNumber(artist.streams)} streams</span>
                </div>
                <small>{formatCurrency(artist.pendingAmount)}</small>
              </div>
            )) : <div className="finance-empty">No payout-ready balances.</div>}
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default AccountantDashboard;
