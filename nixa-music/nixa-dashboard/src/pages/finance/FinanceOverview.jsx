import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, RefreshCw, Search, ShieldCheck, WalletCards } from "lucide-react";
import RevenueStatCard from "../../components/revenue/RevenueStatCard";
import ConfirmModal from "../../components/ui/ConfirmModal";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { financeService } from "../../services/financeService";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import "./Finance.css";

const emptyFinance = {
  summary: {
    grossRevenue: 0,
    netRevenue: 0,
    artistShare: 0,
    labelShare: 0,
    companyShare: 0,
    gstDeduction: 0,
    tdsDeduction: 0,
    payableBalance: 0,
    paidAmount: 0,
    pendingAmount: 0,
    totalStreams: 0,
    payoutReadyArtists: 0,
  },
  monthlyTrend: [],
  artistBreakdown: [],
  labelBreakdown: [],
  platformBreakdown: [],
  pendingPayables: [],
};

const FinanceOverview = () => {
  const { role } = useAuth();
  const [filters, setFilters] = useState({
    search: "",
    reportMonth: "",
    platform: "",
    country: "",
    revenueStatus: "",
  });
  const [data, setData] = useState(emptyFinance);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const canRecalculate = role === "admin";
  const canExport = ["admin", "accountant"].includes(role);

  const loadFinance = useCallback(async () => {
    try {
      setLoading(true);
      const result = await financeService.getFinanceSummary(filters);
      setData({ ...emptyFinance, ...result });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load finance overview." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadFinance, 0);
    return () => window.clearTimeout(timer);
  }, [loadFinance]);

  const stats = useMemo(
    () => [
      {
        title: "Gross Revenue",
        value: formatCurrency(data.summary.grossRevenue),
        caption: "Imported royalty value",
        tone: "cyan",
        icon: WalletCards,
      },
      {
        title: "Payable Balance",
        value: formatCurrency(data.summary.payableBalance),
        caption: "After deductions",
        tone: "purple",
        icon: ShieldCheck,
      },
      {
        title: "Pending Amount",
        value: formatCurrency(data.summary.pendingAmount),
        caption: `${formatNumber(data.summary.payoutReadyArtists)} payout-ready artists`,
        tone: "magenta",
        icon: WalletCards,
      },
      {
        title: "TDS / GST",
        value: formatCurrency(data.summary.tdsDeduction + data.summary.gstDeduction),
        caption: "Tax deductions",
        tone: "green",
        icon: ShieldCheck,
      },
    ],
    [data]
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const response = await financeService.recalculateFinance({ reportMonth: filters.reportMonth || undefined });
      setToast({ type: "success", message: `Recalculated ${response.result.recalculatedRows} revenue rows.` });
      setConfirmOpen(false);
      loadFinance();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Finance recalculation failed." });
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Finance System</p>
          <h2>Split-aware royalty finance with payable, tax and payout controls.</h2>
          <p>Review gross revenue, net revenue, artist and label shares, company share, deductions and pending balances.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadFinance}>
            <RefreshCw size={17} />
            Refresh
          </button>
          {canExport ? (
            <>
              <button className="secondary-button" type="button" onClick={() => financeService.exportFinanceReport("artist", "csv", filters)}>
                <Download size={17} />
                CSV
              </button>
              <button className="primary-button" type="button" onClick={() => financeService.exportFinanceReport("artist", "xlsx", filters)}>
                <Download size={17} />
                Excel
              </button>
            </>
          ) : null}
          {canRecalculate ? (
            <button className="secondary-button" type="button" onClick={() => setConfirmOpen(true)}>
              <RefreshCw size={17} />
              Recalculate
            </button>
          ) : null}
        </div>
      </section>

      <section className="finance-toolbar">
        <label className="finance-search span-2">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search artist, track, ISRC" />
        </label>
        <input type="month" value={filters.reportMonth} onChange={(event) => updateFilter("reportMonth", event.target.value)} />
        <input value={filters.platform} onChange={(event) => updateFilter("platform", event.target.value)} placeholder="Platform" />
        <input value={filters.country} onChange={(event) => updateFilter("country", event.target.value.toUpperCase())} placeholder="Country" maxLength={3} />
        <select value={filters.revenueStatus} onChange={(event) => updateFilter("revenueStatus", event.target.value)}>
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      </section>

      <section className="stats-grid four-columns">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <div className="metric-card skeleton" key={index} />)
          : stats.map((item) => <RevenueStatCard key={item.title} {...item} />)}
      </section>

      <section className="finance-section-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Monthly Payout Trend</h3>
              <p>Payable, paid and pending movement</p>
            </div>
          </div>
          {data.monthlyTrend.length ? (
            <div className="finance-chart">
              <ResponsiveContainer width="100%" height={310}>
                <AreaChart data={data.monthlyTrend}>
                  <defs>
                    <linearGradient id="financePayable" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10d7ff" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10d7ff" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="month" stroke="#8392a7" tickLine={false} axisLine={false} />
                  <YAxis stroke="#8392a7" tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value) / 1000}K`} />
                  <Tooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} formatter={(value) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="payableAmount" stroke="#10d7ff" strokeWidth={3} fill="url(#financePayable)" />
                  <Area type="monotone" dataKey="pendingAmount" stroke="#f43f9a" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="finance-empty">No finance trend yet. Recalculate revenue after importing CSV reports.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Platform Payables</h3>
              <p>Payable balance by platform</p>
            </div>
          </div>
          {data.platformBreakdown.length ? (
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={data.platformBreakdown.slice(0, 8)} layout="vertical">
                <CartesianGrid stroke="rgba(255,255,255,0.07)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#8392a7" width={110} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="payableAmount" fill="#a855f7" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="finance-empty">No platform payable data.</div>
          )}
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel finance-table">
          <div className="panel-heading">
            <div>
              <h3>Artist-wise Finance</h3>
              <p>Gross, payable and pending balances</p>
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
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {data.artistBreakdown.slice(0, 10).map((artist) => (
                  <tr key={artist.id || artist.name}>
                    <td>{artist.name}</td>
                    <td>{formatNumber(artist.streams)}</td>
                    <td>{formatCurrency(artist.grossRevenue)}</td>
                    <td>{formatCurrency(artist.payableAmount)}</td>
                    <td>{formatCurrency(artist.pendingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Pending Payables</h3>
              <p>Payout-ready artists</p>
            </div>
          </div>
          <div className="mini-list">
            {data.pendingPayables.length ? (
              data.pendingPayables.slice(0, 8).map((artist) => (
                <div className="mini-list-row" key={artist.id || artist.name}>
                  <div>
                    <strong>{artist.name}</strong>
                    <span>{formatNumber(artist.streams)} streams</span>
                  </div>
                  <small>{formatCurrency(artist.pendingAmount)}</small>
                </div>
              ))
            ) : (
              <div className="finance-empty">No pending payable balances.</div>
            )}
          </div>
        </article>
      </section>

      <ConfirmModal
        open={confirmOpen}
        title="Recalculate finance?"
        message="This re-runs split rules against calculated revenue and refreshes payable, tax and pending balances."
        confirmLabel={recalculating ? "Recalculating..." : "Recalculate"}
        onConfirm={handleRecalculate}
        onCancel={() => setConfirmOpen(false)}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default FinanceOverview;
