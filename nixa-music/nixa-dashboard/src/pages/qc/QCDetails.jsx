import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, LockKeyholeOpen, RadioTower, RefreshCw, ShieldCheck } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { releaseService } from "../../services/releaseService";
import { formatReleaseDate } from "../../utils/releaseFormatters";
import "./QCDelivery.css";

const categoryNames = ["metadata", "artwork", "audio", "rights", "delivery"];

const QCDetails = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [toast, setToast] = useState(null);
  const { role } = useAuth();
  const qcDashboardPath = role === "accountant" ? "/accountant/qc" : "/qc";

  const loadDetails = useCallback(async () => {
    try {
      setLoading(true);
      const result = await releaseService.getQcDetails(id);
      setData(result.data || result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not load QC details." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const report = data?.report;
  const release = data?.release;
  const categories = useMemo(() => report?.categories || {}, [report]);

  const runQc = async () => {
    try {
      setActionLoading("qc");
      const result = await releaseService.runQc(id);
      setToast({ type: "success", message: result.message || "QC run complete." });
      await loadDetails();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "QC run failed." });
    } finally {
      setActionLoading("");
    }
  };

  const queueDelivery = async () => {
    try {
      setActionLoading("queue");
      const result = await releaseService.queueDelivery(id, { force: true });
      setToast({ type: "success", message: result.message || "Delivery queued." });
      await loadDetails();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Delivery queue failed." });
    } finally {
      setActionLoading("");
    }
  };

  const retryDelivery = async (item) => {
    try {
      setActionLoading(`retry-${item.id || item.queue_id}`);
      const queueId = item.id || item.queue_id;
      const result = await releaseService.retryDelivery(id, queueId);
      setToast({ type: "success", message: result.message || "Retry queued." });
      await loadDetails();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Retry failed." });
    } finally {
      setActionLoading("");
    }
  };

  const unlockMetadata = async () => {
    if (!unlockReason.trim()) {
      setToast({ type: "error", message: "Add an unlock reason first." });
      return;
    }

    try {
      setActionLoading("unlock");
      const result = await releaseService.unlockMetadata(id, { reason: unlockReason });
      setToast({ type: "success", message: result.message || "Metadata unlocked." });
      setUnlockReason("");
      await loadDetails();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unlock failed." });
    } finally {
      setActionLoading("");
    }
  };

  if (loading) {
    return (
      <section className="page-stack">
        <div className="skeleton detail-skeleton-main" />
        <div className="skeleton catalog-skeleton-row" />
      </section>
    );
  }

  if (!release) {
    return (
      <section className="empty-state">
        <span>QC Detail</span>
        <h2>Release not found</h2>
        <p>This release may have been deleted or you may not have access.</p>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="section-hero">
        <div>
          <p className="eyebrow">QC Detail</p>
          <h1>{release.release_title || release.title}</h1>
          <p>{release.primary_artist || "No artist"} / {release.label_name || "No label"} / updated {formatReleaseDate(release.updated_at)}</p>
        </div>
        <div className="ops-actions">
          <Link className="secondary-button" to={qcDashboardPath}>
            <ArrowLeft size={16} />
            QC Dashboard
          </Link>
          <button className="secondary-button" type="button" onClick={runQc} disabled={Boolean(actionLoading)}>
            {actionLoading === "qc" ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
            Run QC
          </button>
          <button className="primary-button" type="button" onClick={queueDelivery} disabled={Boolean(actionLoading)}>
            {actionLoading === "queue" ? <Loader2 className="spin" size={16} /> : <RadioTower size={16} />}
            Queue Delivery
          </button>
        </div>
      </div>

      <div className="ops-grid">
        <article className="ops-card">
          <span>QC Score</span>
          <strong>{report?.qc_score ?? release.qc_score ?? 0}%</strong>
          <small>{report?.status || release.qc_status || "pending"}</small>
        </article>
        <article className="ops-card">
          <span>Metadata Completion</span>
          <strong>{report?.metadata_completion ?? release.metadata_completion_percentage ?? 0}%</strong>
          <small>{(data.tracks || []).length} tracks checked</small>
        </article>
        <article className="ops-card">
          <span>Release Health</span>
          <strong>{report?.release_health ?? release.release_health_score ?? 0}%</strong>
          <small>QC, rights, artwork and DSP readiness</small>
        </article>
        <article className="ops-card">
          <span>Delivery Status</span>
          <strong>{release.delivery_status || "pending"}</strong>
          <small>{(data.deliveryQueue || []).length} queue entries</small>
        </article>
      </div>

      <section className="ops-panel">
        <div className="ops-panel-header">
          <div>
            <h3>QC Categories</h3>
            <p>Metadata, artwork, audio, rights, and DSP delivery checks from the latest QC run.</p>
          </div>
          <div className="qc-score-ring"><strong>{report?.qc_score || release.qc_score || 0}</strong></div>
        </div>

        <div className="qc-category-grid">
          {categoryNames.map((name) => {
            const category = categories[name] || {};
            return (
              <article className="qc-category-card" key={name}>
                <span>{name}</span>
                <strong>{category.score ?? 0}%</strong>
                <small className={`status-dot ${category.status || "pending"}`}>{category.status || "pending"}</small>
                <ul>
                  {(category.errors || []).slice(0, 2).map((message) => <li key={message}><AlertTriangle size={12} /> {message}</li>)}
                  {(category.warnings || []).slice(0, 2).map((message) => <li key={message}>{message}</li>)}
                  {!(category.errors || []).length && !(category.warnings || []).length && <li><CheckCircle2 size={12} /> No issues recorded.</li>}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <div className="ops-split">
        <section className="ops-table-panel">
          <div className="ops-panel-header">
            <div>
              <h3>Delivery Matrix</h3>
              <p>Retry failed platforms or inspect queue state per DSP.</p>
            </div>
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Retries</th>
                  <th>Next Retry</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data.deliveryQueue || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.platform}</td>
                    <td><span className={`status-dot ${item.delivery_status}`}>{item.delivery_status}</span></td>
                    <td>{item.retry_count || 0}</td>
                    <td>{formatReleaseDate(item.next_retry)}</td>
                    <td>{formatReleaseDate(item.updated_at)}</td>
                    <td>
                      <button className="secondary-button" type="button" disabled={Boolean(actionLoading)} onClick={() => retryDelivery(item)}>
                        {actionLoading === `retry-${item.id}` ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
                {!(data.deliveryQueue || []).length && (
                  <tr>
                    <td colSpan="6">No delivery queue entries for this release.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ops-panel">
          <div className="ops-panel-header">
            <div>
              <h3>Metadata Lock Override</h3>
              <p>Approved, delivered, and live releases are locked. Admin override is logged for audit.</p>
            </div>
          </div>
          <textarea value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} placeholder="Reason for temporary unlock" />
          <button className="secondary-button" type="button" onClick={unlockMetadata} disabled={Boolean(actionLoading)}>
            {actionLoading === "unlock" ? <Loader2 className="spin" size={16} /> : <LockKeyholeOpen size={16} />}
            Unlock 48h
          </button>
          {(data.locks || []).length ? (
            <ul className="ops-message-list">
              {data.locks.slice(0, 5).map((lock) => (
                <li key={lock.id}>{lock.action} / {lock.reason} / {formatReleaseDate(lock.created_at)}</li>
              ))}
            </ul>
          ) : (
            <p className="soft-copy">No lock override history.</p>
          )}
        </section>
      </div>

      <section className="ops-table-panel">
        <div className="ops-panel-header">
          <div>
            <h3>Track QC Reports</h3>
            <p>Per-track metadata and audio checks.</p>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Track</th>
                <th>ISRC</th>
                <th>Status</th>
                <th>Score</th>
                <th>Completion</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              {(data.trackReports || []).map((track) => (
                <tr key={track.id}>
                  <td>{track.track_title || track.track_id}</td>
                  <td>{track.isrc || "Pending"}</td>
                  <td><span className={`status-dot ${track.status}`}>{track.status}</span></td>
                  <td>{track.qc_score}%</td>
                  <td>{track.metadata_completion}%</td>
                  <td>{(track.warnings || []).slice(0, 2).join(" / ") || "No warnings"}</td>
                </tr>
              ))}
              {!(data.trackReports || []).length && (
                <tr>
                  <td colSpan="6">Run QC to generate track-level reports.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ops-table-panel">
        <div className="ops-panel-header">
          <div>
            <h3>Conflicts & Suggestions</h3>
            <p>Duplicate codes, similar catalog items, and smart metadata recommendations.</p>
          </div>
        </div>
        <ul className="ops-message-list">
          {(data.conflicts || []).map((conflict) => (
            <li key={conflict.id}><span className={`status-dot ${conflict.severity}`}>{conflict.conflict_type}</span> {conflict.message}</li>
          ))}
          {(report?.suggestions || []).map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
          {!(data.conflicts || []).length && !(report?.suggestions || []).length && <li>No conflicts or suggestions recorded.</li>}
        </ul>
      </section>
    </section>
  );
};

export default QCDetails;
