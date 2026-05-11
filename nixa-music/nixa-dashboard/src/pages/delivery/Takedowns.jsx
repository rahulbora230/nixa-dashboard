import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, RefreshCw, Search, XCircle } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { releaseService } from "../../services/releaseService";
import { formatReleaseDate } from "../../utils/releaseFormatters";
import "../qc/QCDelivery.css";

const statuses = ["all", "requested", "processing", "completed", "rejected"];

const Takedowns = () => {
  const [status, setStatus] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [toast, setToast] = useState(null);

  const loadTakedowns = async () => {
    try {
      setLoading(true);
      const result = await releaseService.listTakedowns({ status: status === "all" ? "" : status });
      setItems(result.data?.takedowns || []);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not load takedowns." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTakedowns();
  }, [status]);

  const updateStatus = async (id, nextStatus) => {
    try {
      setActionLoading(`${id}-${nextStatus}`);
      const result = await releaseService.updateTakedownStatus(id, { status: nextStatus });
      setToast({ type: "success", message: result.message || "Takedown updated." });
      await loadTakedowns();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Takedown update failed." });
    } finally {
      setActionLoading("");
    }
  };

  return (
    <section className="page-stack">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="section-hero">
        <div>
          <p className="eyebrow">DSP Operations</p>
          <h1>Takedown Requests</h1>
          <p>Manage full, platform-specific, territory-specific, and scheduled takedowns.</p>
        </div>
        <button className="secondary-button" type="button" onClick={loadTakedowns}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <section className="ops-table-panel">
        <div className="ops-filter-row">
          <Search size={16} />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statuses.map((item) => (
              <option value={item} key={item}>{item}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="skeleton catalog-skeleton-row" />
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Release</th>
                  <th>Type</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Effective</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/release/${item.release_id}`}>{item.release_title || item.release_id}</Link>
                      <span>{item.primary_artist || ""}</span>
                    </td>
                    <td>{item.takedown_type}</td>
                    <td>{item.platform || item.territory || "Full catalog"}</td>
                    <td><span className={`status-dot ${item.status}`}>{item.status}</span></td>
                    <td>{item.reason || "No reason"}</td>
                    <td>{formatReleaseDate(item.effective_date)}</td>
                    <td>{formatReleaseDate(item.created_at)}</td>
                    <td>
                      <div className="ops-actions">
                        {item.status === "requested" && (
                          <button className="secondary-button" type="button" disabled={Boolean(actionLoading)} onClick={() => updateStatus(item.id, "processing")}>
                            {actionLoading === `${item.id}-processing` ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
                            Process
                          </button>
                        )}
                        {["requested", "processing"].includes(item.status) && (
                          <button className="secondary-button" type="button" disabled={Boolean(actionLoading)} onClick={() => updateStatus(item.id, "completed")}>
                            {actionLoading === `${item.id}-completed` ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                            Complete
                          </button>
                        )}
                        {item.status !== "rejected" && item.status !== "completed" && (
                          <button className="danger-button" type="button" disabled={Boolean(actionLoading)} onClick={() => updateStatus(item.id, "rejected")}>
                            {actionLoading === `${item.id}-rejected` ? <Loader2 className="spin" size={14} /> : <XCircle size={14} />}
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan="8">No takedown requests found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
};

export default Takedowns;
