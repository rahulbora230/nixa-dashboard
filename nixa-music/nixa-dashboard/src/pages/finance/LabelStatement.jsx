import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Search } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { financeService } from "../../services/financeService";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import "./Finance.css";

const emptyStatement = { summary: {}, artistBreakdown: [], trackBreakdown: [], platformBreakdown: [] };

const LabelStatement = () => {
  const { role } = useAuth();
  const [labelId, setLabelId] = useState(role === "label" ? "me" : "");
  const [filters, setFilters] = useState({ reportMonth: "", from: "", to: "" });
  const [statement, setStatement] = useState(emptyStatement);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadStatement = useCallback(async () => {
    if (role !== "label" && !labelId.trim()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await financeService.getLabelStatement(labelId || "me", filters);
      setStatement({ ...emptyStatement, ...result });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load label statement." });
    } finally {
      setLoading(false);
    }
  }, [filters, labelId, role]);

  useEffect(() => {
    const timer = window.setTimeout(loadStatement, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatement]);

  const exportStatement = async (format) => {
    try {
      await financeService.exportLabelStatement(labelId || "me", format, filters);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Statement export failed." });
    }
  };

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Label Statement</p>
          <h2>{statement.labelName || "Label"} financial statement.</h2>
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
        {role !== "label" ? (
          <label className="finance-search span-2">
            <Search size={16} />
            <input value={labelId} onChange={(event) => setLabelId(event.target.value)} placeholder="Label UUID" />
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
            <article className="metric-card tone-cyan"><div><span>Total Revenue</span><strong>{formatCurrency(statement.summary.grossRevenue)}</strong><small>{formatNumber(statement.summary.totalStreams)} streams</small></div></article>
            <article className="metric-card tone-purple"><div><span>Label Share</span><strong>{formatCurrency(statement.summary.labelShare)}</strong><small>Configured split</small></div></article>
            <article className="metric-card tone-magenta"><div><span>Company Share</span><strong>{formatCurrency(statement.summary.companyShare)}</strong><small>Company allocation</small></div></article>
            <article className="metric-card tone-green"><div><span>Pending</span><strong>{formatCurrency(statement.summary.pendingAmount)}</strong><small>Statement balance</small></div></article>
          </>
        )}
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel finance-table">
          <div className="panel-heading">
            <div>
              <h3>Artist-wise Revenue</h3>
              <p>Label roster statement rows</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artist</th>
                  <th>Streams</th>
                  <th>Gross</th>
                  <th>Artist Share</th>
                  <th>Label Share</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {statement.artistBreakdown.map((artist) => (
                  <tr key={artist.id || artist.name}>
                    <td>{artist.name}</td>
                    <td>{formatNumber(artist.streams)}</td>
                    <td>{formatCurrency(artist.grossRevenue)}</td>
                    <td>{formatCurrency(artist.artistShare)}</td>
                    <td>{formatCurrency(artist.labelShare)}</td>
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
              <h3>Top Tracks</h3>
              <p>Track-level label statement</p>
            </div>
          </div>
          <div className="mini-list">
            {statement.trackBreakdown.length ? statement.trackBreakdown.slice(0, 10).map((track) => (
              <div className="mini-list-row" key={track.id || track.name}>
                <div>
                  <strong>{track.name}</strong>
                  <span>{formatNumber(track.streams)} streams</span>
                </div>
                <small>{formatCurrency(track.grossRevenue)}</small>
              </div>
            )) : <div className="finance-empty">No track statement rows.</div>}
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default LabelStatement;
