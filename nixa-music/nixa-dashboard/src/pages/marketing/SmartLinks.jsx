import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Copy, ExternalLink, Link2, Plus, QrCode, RefreshCw, Search, Trash2 } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { getMarketingAssetUrl, smartLinkService } from "../../services/smartLinkService";
import { formatDate, formatNumber } from "../../utils/formatters";
import "./Marketing.css";

const statusOptions = ["", "active", "draft", "inactive", "pre_save"];

const SmartLinks = () => {
  const { role } = useAuth();
  const [links, setLinks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const canCreate = ["admin", "artist", "label"].includes(role);

  const loadLinks = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const data = await smartLinkService.list({ ...filters, page, limit: 20 });
        setLinks(data.smartLinks || []);
        setPagination(data.pagination || { page, total: 0, pages: 1 });
      } catch (error) {
        setToast({ type: "error", message: error.response?.data?.message || "Could not load smart links." });
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    loadLinks(1);
  }, [loadLinks]);

  const stats = useMemo(() => {
    const clicks = links.reduce((sum, link) => sum + Number(link.click_count || 0), 0);
    const live = links.filter((link) => link.status === "active" || link.status === "pre_save").length;
    const platforms = links.reduce((sum, link) => sum + Number(link.platform_count || link.platforms?.length || 0), 0);

    return { clicks, live, platforms };
  }, [links]);

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setToast({ type: "success", message: "Smart link copied." });
    } catch {
      setToast({ type: "error", message: "Could not copy link." });
    }
  };

  const archiveLink = async (id) => {
    if (!window.confirm("Archive this smart link? Public visitors will no longer see it.")) {
      return;
    }

    try {
      await smartLinkService.remove(id);
      setToast({ type: "success", message: "Smart link archived." });
      loadLinks(pagination.page || 1);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not archive smart link." });
    }
  };

  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div>
          <span className="marketing-eyebrow">
            <Link2 size={16} /> Marketing tools
          </span>
          <h1>Smart Links</h1>
          <p>Create release and track landing pages with DSP buttons, QR codes, promo kits and click analytics.</p>
        </div>
        <div className="marketing-actions">
          <Link className="marketing-button" to="/marketing/analytics">
            <BarChart3 size={17} /> Analytics
          </Link>
          {canCreate ? (
            <Link className="marketing-button primary" to="/marketing/smart-links/new">
              <Plus size={17} /> Create smart link
            </Link>
          ) : null}
        </div>
      </section>

      <section className="marketing-grid">
        <article className="marketing-stat-card">
          <span>Visible links</span>
          <strong>{formatNumber(stats.live)}</strong>
        </article>
        <article className="marketing-stat-card">
          <span>Total clicks</span>
          <strong>{formatNumber(stats.clicks)}</strong>
        </article>
        <article className="marketing-stat-card">
          <span>DSP buttons</span>
          <strong>{formatNumber(stats.platforms)}</strong>
        </article>
        <article className="marketing-stat-card">
          <span>Total records</span>
          <strong>{formatNumber(pagination.total)}</strong>
        </article>
      </section>

      <section className="marketing-toolbar">
        <div className="marketing-filter-group">
          <label className="marketing-search">
            <Search size={16} />
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search title, slug, artist or release"
            />
          </label>
          <select
            className="marketing-select"
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          >
            {statusOptions.map((status) => (
              <option key={status || "all"} value={status}>
                {status ? status.replace("_", " ") : "All statuses"}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="marketing-button" onClick={() => loadLinks(pagination.page || 1)}>
          <RefreshCw size={16} /> Refresh
        </button>
      </section>

      <section className="marketing-panel">
        <div className="marketing-panel-header">
          <div>
            <h2>Release landing links</h2>
            <p className="marketing-muted">Every row can power a public landing page, promo kit and QR card.</p>
          </div>
        </div>

        {loading ? (
          <div className="marketing-skeleton" />
        ) : links.length ? (
          <div className="marketing-table-wrap">
            <table className="marketing-table">
              <thead>
                <tr>
                  <th>Smart link</th>
                  <th>Status</th>
                  <th>Clicks</th>
                  <th>DSPs</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id}>
                    <td>
                      <div className="marketing-link-cell">
                        <img
                          className="marketing-artwork"
                          src={getMarketingAssetUrl(link.artwork_url || link.release?.artwork_url)}
                          alt=""
                        />
                        <div>
                          <strong>{link.title}</strong>
                          <span>{link.release?.artist || link.release?.title || link.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`marketing-status ${link.status}`}>{link.status}</span>
                    </td>
                    <td>{formatNumber(link.click_count)}</td>
                    <td>{formatNumber(link.platform_count || link.platforms?.length || 0)}</td>
                    <td>{formatDate(link.updated_at || link.created_at)}</td>
                    <td>
                      <div className="marketing-row-actions">
                        <Link className="marketing-button" to={`/marketing/smart-links/${link.id}`} title="Details">
                          <QrCode size={16} />
                        </Link>
                        <button
                          type="button"
                          className="marketing-button"
                          onClick={() => copyLink(link.public_url)}
                          title="Copy link"
                        >
                          <Copy size={16} />
                        </button>
                        <a className="marketing-button" href={link.public_url} target="_blank" rel="noreferrer" title="Open public link">
                          <ExternalLink size={16} />
                        </a>
                        {canCreate ? (
                          <button
                            type="button"
                            className="marketing-button danger"
                            onClick={() => archiveLink(link.id)}
                            title="Archive"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-marketing">
            <div>
              <h3>No smart links yet</h3>
              <p>Choose a release and build the first public marketing page.</p>
            </div>
          </div>
        )}
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default SmartLinks;
