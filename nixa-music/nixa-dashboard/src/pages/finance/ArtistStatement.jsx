import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Search } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { financeService } from "../../services/financeService";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import "./Finance.css";

const emptyStatement = { summary: {}, trackBreakdown: [], platformBreakdown: [], monthlyTrend: [] };

const ArtistStatement = () => {
  const { role } = useAuth();
  const [artistId, setArtistId] = useState(role === "artist" ? "me" : "");
  const [filters, setFilters] = useState({ reportMonth: "", from: "", to: "" });
  const [statement, setStatement] = useState(emptyStatement);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadStatement = useCallback(async () => {
    if (role !== "artist" && !artistId.trim()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await financeService.getArtistStatement(artistId || "me", filters);
      setStatement({ ...emptyStatement, ...result });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load artist statement." });
    } finally {
      setLoading(false);
    }
  }, [artistId, filters, role]);

  useEffect(() => {
    const timer = window.setTimeout(loadStatement, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatement]);

  const exportStatement = async (format) => {
    try {
      await financeService.exportArtistStatement(artistId || "me", format, filters);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Statement export failed." });
    }
  };

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Artist Statement</p>
          <h2>{statement.artistName || "Artist"} financial statement.</h2>
          <p>Period: {statement.period || "All periods"}</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={() => exportStatement("pdf")}>
            <FileText size={17} />
            PDF
          </button>
          <button className="primary-button" type="button" onClick={() => exportStatement("excel")}>
            <Download size={17} />
            Excel
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
        <input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
        <input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
        <button className="secondary-button" type="button" onClick={loadStatement}>
          Load
        </button>
      </section>

      <section className="stats-grid four-columns">
        {loading ? Array.from({ length: 4 }).map((_, index) => <div className="metric-card skeleton" key={index} />) : (
          <>
            <article className="metric-card tone-cyan"><div><span>Gross Revenue</span><strong>{formatCurrency(statement.summary.grossRevenue)}</strong><small>{formatNumber(statement.summary.totalStreams)} streams</small></div></article>
            <article className="metric-card tone-purple"><div><span>Artist Share</span><strong>{formatCurrency(statement.summary.artistShare)}</strong><small>Before deductions</small></div></article>
            <article className="metric-card tone-magenta"><div><span>Deductions</span><strong>{formatCurrency((statement.summary.gstDeduction || 0) + (statement.summary.tdsDeduction || 0))}</strong><small>GST + TDS</small></div></article>
            <article className="metric-card tone-green"><div><span>Pending</span><strong>{formatCurrency(statement.summary.pendingAmount)}</strong><small>Statement balance</small></div></article>
          </>
        )}
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel finance-table">
          <div className="panel-heading">
            <div>
              <h3>Track-wise Breakdown</h3>
              <p>Statement rows by track</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Track</th>
                  <th>Streams</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Artist Share</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {statement.trackBreakdown.map((track) => (
                  <tr key={track.id || track.name}>
                    <td>{track.name}</td>
                    <td>{formatNumber(track.streams)}</td>
                    <td>{formatCurrency(track.grossRevenue)}</td>
                    <td>{formatCurrency(track.netRevenue)}</td>
                    <td>{formatCurrency(track.artistShare)}</td>
                    <td>{formatCurrency(track.pendingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Platform Breakdown</h3>
              <p>Statement rows by DSP</p>
            </div>
          </div>
          <div className="mini-list">
            {statement.platformBreakdown.length ? statement.platformBreakdown.map((platform) => (
              <div className="mini-list-row" key={platform.name}>
                <div>
                  <strong>{platform.name}</strong>
                  <span>{formatNumber(platform.streams)} streams</span>
                </div>
                <small>{formatCurrency(platform.payableAmount)}</small>
              </div>
            )) : <div className="finance-empty">No platform statement rows.</div>}
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default ArtistStatement;
