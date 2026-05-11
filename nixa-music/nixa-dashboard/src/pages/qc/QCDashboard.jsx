import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, Loader2, RadioTower, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { releaseService } from "../../services/releaseService";
import { formatReleaseDate } from "../../utils/releaseFormatters";
import "./QCDelivery.css";

const QCDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [toast, setToast] = useState(null);
  const { role } = useAuth();
  const qcDetailBase = role === "accountant" ? "/accountant/qc" : "/qc";

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [qcData, queueData] = await Promise.all([
        releaseService.getQcDashboard(),
        releaseService.listDeliveryQueue({ status: "" }),
      ]);
      setDashboard(qcData.data || qcData);
      setQueue(queueData.data?.queue || []);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not load QC dashboard." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const summary = dashboard?.summary || {};
  const cards = useMemo(
    () => [
      { label: "Pending Review", value: summary.pending_review || 0, helper: "Submitted and QC-stage releases", icon: ShieldCheck },
      { label: "Failed QC", value: summary.failed_qc || 0, helper: "Needs correction before delivery", icon: AlertTriangle },
      { label: "Avg QC Score", value: `${summary.average_qc_score || 0}%`, helper: "Latest release metadata quality", icon: Sparkles },
      { label: "Avg Health", value: `${summary.average_health_score || 0}%`, helper: "QC + delivery readiness", icon: Activity },
    ],
    [summary]
  );

  const runQc = async (releaseId) => {
    try {
      setActionLoading(`qc-${releaseId}`);
      const result = await releaseService.runQc(releaseId);
      setToast({ type: "success", message: result.message || "QC run complete." });
      await loadDashboard();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "QC run failed." });
    } finally {
      setActionLoading("");
    }
  };

  const queueDelivery = async (releaseId) => {
    try {
      setActionLoading(`queue-${releaseId}`);
      const result = await releaseService.queueDelivery(releaseId, { force: true });
      setToast({ type: "success", message: result.message || "Delivery queued." });
      await loadDashboard();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Delivery queue failed." });
    } finally {
      setActionLoading("");
    }
  };

  const retryDelivery = async (item) => {
    try {
      setActionLoading(`retry-${item.id}`);
      const result = await releaseService.retryDelivery(item.release_id, item.id);
      setToast({ type: "success", message: result.message || "Retry queued." });
      await loadDashboard();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Retry failed." });
    } finally {
      setActionLoading("");
    }
  };

  if (loading) {
    return (
      <section className="page-stack">
        <div className="skeleton detail-skeleton-main" />
        <div className="skeleton catalog-skeleton-row" />
        <div className="skeleton catalog-skeleton-row" />
      </section>
    );
  }

  return (
    <section className="page-stack">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="section-hero">
        <div>
          <p className="eyebrow">Catalog Intelligence</p>
          <h1>QC & DSP Operations</h1>
          <p>Review metadata quality, release health, delivery readiness, and retryable DSP queue items.</p>
        </div>
        <button className="secondary-button" type="button" onClick={loadDashboard}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="ops-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="ops-card" key={card.label}>
              <Icon size={20} />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.helper}</small>
            </article>
          );
        })}
      </div>

      <div className="ops-split">
        <section className="ops-table-panel">
          <div className="ops-panel-header">
            <div>
              <h3>Pending QC Releases</h3>
              <p>Run QC, inspect detail, or queue delivery after approval.</p>
            </div>
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Release</th>
                  <th>Artist</th>
                  <th>Status</th>
                  <th>QC</th>
                  <th>Health</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.pendingReleases || []).map((release) => (
                  <tr key={release.id}>
                    <td>
                      <Link to={`${qcDetailBase}/${release.id}`}>{release.release_title || "Untitled release"}</Link>
                    </td>
                    <td>{release.primary_artist || "Not provided"}</td>
                    <td><span className={`status-dot ${release.status}`}>{release.status}</span></td>
                    <td>{release.qc_score || 0}%</td>
                    <td>{release.release_health_score || 0}%</td>
                    <td>{formatReleaseDate(release.updated_at)}</td>
                    <td>
                      <div className="ops-actions">
                        <button className="secondary-button" type="button" onClick={() => runQc(release.id)} disabled={Boolean(actionLoading)}>
                          {actionLoading === `qc-${release.id}` ? <Loader2 className="spin" size={14} /> : <ShieldCheck size={14} />}
                          QC
                        </button>
                        <button className="secondary-button" type="button" onClick={() => queueDelivery(release.id)} disabled={Boolean(actionLoading)}>
                          {actionLoading === `queue-${release.id}` ? <Loader2 className="spin" size={14} /> : <RadioTower size={14} />}
                          Queue
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!(dashboard?.pendingReleases || []).length && (
                  <tr>
                    <td colSpan="7">No pending QC releases.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ops-table-panel">
          <div className="ops-panel-header">
            <div>
              <h3>Retry Queue</h3>
              <p>Failed or pending DSP deliveries that need operations attention.</p>
            </div>
          </div>
          <div className="ops-message-list">
            {queue.slice(0, 10).map((item) => (
              <article className="ops-card" key={item.id}>
                <span>{item.platform}</span>
                <strong>{item.release_title || "Untitled release"}</strong>
                <small>{item.track_title || item.isrc || "Release package"} / retry {item.retry_count || 0}</small>
                <div className="ops-actions">
                  <span className={`status-dot ${item.delivery_status}`}>{item.delivery_status}</span>
                  {["failed", "rejected", "retry_failed", "queued"].includes(item.delivery_status) && (
                    <button className="secondary-button" type="button" disabled={Boolean(actionLoading)} onClick={() => retryDelivery(item)}>
                      {actionLoading === `retry-${item.id}` ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
                      Retry
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!queue.length && <p className="soft-copy">No delivery queue items yet.</p>}
          </div>
        </section>
      </div>

      <section className="ops-table-panel">
        <div className="ops-panel-header">
          <div>
            <h3>Failed QC Reports</h3>
            <p>Newest failed QC runs across the catalog.</p>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Release</th>
                <th>Status</th>
                <th>Score</th>
                <th>Health</th>
                <th>Errors</th>
                <th>Run</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.failedReports || []).map((report) => (
                <tr key={report.id}>
                  <td><Link to={`${qcDetailBase}/${report.release_id}`}>{report.release_title}</Link></td>
                  <td><span className={`status-dot ${report.status}`}>{report.status}</span></td>
                  <td>{report.qc_score}%</td>
                  <td>{report.release_health}%</td>
                  <td>{(report.errors || []).slice(0, 2).join(" / ") || "No errors"}</td>
                  <td>{formatReleaseDate(report.created_at)}</td>
                </tr>
              ))}
              {!(dashboard?.failedReports || []).length && (
                <tr>
                  <td colSpan="6">
                    <CheckCircle2 size={15} /> No failed QC reports.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};

export default QCDashboard;
