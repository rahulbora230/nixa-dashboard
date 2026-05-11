import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CalendarDays, ExternalLink, Link2, RefreshCw } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { getMarketingAssetUrl, smartLinkService } from "../../services/smartLinkService";
import { formatNumber } from "../../utils/formatters";
import "./Marketing.css";

const MarketingAnalytics = () => {
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await smartLinkService.getOverview(filters);
      setData(response);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not load marketing analytics." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const summary = data?.summary || {};
  const topPlatform = useMemo(() => data?.platformClicks?.[0]?.platform || "No clicks yet", [data?.platformClicks]);

  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div>
          <span className="marketing-eyebrow">
            <BarChart3 size={16} /> Marketing intelligence
          </span>
          <h1>Marketing Analytics</h1>
          <p>Track smart-link clicks, DSP intent, countries, referrers and top release campaigns.</p>
        </div>
        <div className="marketing-actions">
          <Link className="marketing-button" to="/marketing/smart-links">
            <Link2 size={17} /> Smart links
          </Link>
          <button type="button" className="marketing-button" onClick={loadAnalytics}>
            <RefreshCw size={17} /> Refresh
          </button>
        </div>
      </section>

      <section className="marketing-toolbar">
        <div className="marketing-filter-group">
          <label>
            <span className="marketing-label">From</span>
            <input
              className="marketing-input"
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            />
          </label>
          <label>
            <span className="marketing-label">To</span>
            <input
              className="marketing-input"
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
        </div>
        <span className="marketing-eyebrow">
          <CalendarDays size={16} /> {filters.from || "All"} to {filters.to || "today"}
        </span>
      </section>

      <section className="marketing-grid">
        <article className="marketing-stat-card">
          <span>Smart links</span>
          <strong>{formatNumber(summary.total_smart_links)}</strong>
        </article>
        <article className="marketing-stat-card">
          <span>Total clicks</span>
          <strong>{formatNumber(summary.total_clicks)}</strong>
        </article>
        <article className="marketing-stat-card">
          <span>Unique visitors</span>
          <strong>{formatNumber(summary.unique_visitors)}</strong>
        </article>
        <article className="marketing-stat-card">
          <span>Top platform</span>
          <strong>{topPlatform}</strong>
        </article>
      </section>

      {loading ? (
        <div className="marketing-skeleton" />
      ) : (
        <>
          <section className="marketing-panel">
            <div className="marketing-panel-header">
              <div>
                <h2>Daily clicks</h2>
                <p className="marketing-muted">Public smart-link click activity over time.</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data?.dailyClicks || []}>
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,.25)" }} />
                <Area type="monotone" dataKey="clicks" stroke="#22d3ee" fill="#d946ef" fillOpacity={0.26} />
              </AreaChart>
            </ResponsiveContainer>
          </section>

          <section className="marketing-grid">
            <article className="marketing-panel">
              <h3>DSP platform intent</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data?.platformClicks || []}>
                  <XAxis dataKey="platform" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,.25)" }} />
                  <Bar dataKey="clicks" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>
            <article className="marketing-panel">
              <h3>Countries</h3>
              <div className="platform-list">
                {(data?.countryClicks || []).map((row) => (
                  <div className="caption-box" key={row.country}>
                    <strong>{row.country}</strong>
                    <p>{formatNumber(row.clicks)} clicks</p>
                  </div>
                ))}
              </div>
            </article>
            <article className="marketing-panel">
              <h3>Referrers</h3>
              <div className="platform-list">
                {(data?.referrers || []).map((row) => (
                  <div className="caption-box" key={row.referrer}>
                    <strong>{row.referrer}</strong>
                    <p>{formatNumber(row.clicks)} clicks</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="marketing-panel">
            <div className="marketing-panel-header">
              <div>
                <h2>Top releases</h2>
                <p className="marketing-muted">Campaigns ranked by tracked clicks.</p>
              </div>
            </div>
            <div className="marketing-table-wrap">
              <table className="marketing-table">
                <thead>
                  <tr>
                    <th>Release</th>
                    <th>Artist</th>
                    <th>Clicks</th>
                    <th>Smart link</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topReleases || []).map((release) => (
                    <tr key={release.release_id}>
                      <td>
                        <div className="marketing-link-cell">
                          <img className="marketing-artwork" src={getMarketingAssetUrl(release.artwork_url)} alt="" />
                          <strong>{release.release_title}</strong>
                        </div>
                      </td>
                      <td>{release.primary_artist}</td>
                      <td>{formatNumber(release.clicks)}</td>
                      <td>
                        <Link className="marketing-button" to={`/marketing/promo-kit/${release.release_id}`}>
                          <ExternalLink size={16} /> Promo kit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default MarketingAnalytics;
