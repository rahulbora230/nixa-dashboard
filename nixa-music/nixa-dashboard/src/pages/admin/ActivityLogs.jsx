import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { activityLogService } from "../../services/activityLogService";
import { formatDate } from "../../utils/formatters";
import "../management/Management.css";

const ActivityLogs = () => {
  const [filters, setFilters] = useState({ search: "", entityType: "", action: "", page: 1, limit: 20 });
  const [data, setData] = useState({ logs: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await activityLogService.getActivityLogs(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load activity logs." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadLogs, 0);
    return () => window.clearTimeout(timer);
  }, [loadLogs]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  return (
    <div className="page-stack management-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Activity Logs</p>
          <h2>Audit important user, artist, label and profile actions.</h2>
          <p>Track onboarding, disablement, assignment, password resets and profile updates.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadLogs}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      <section className="management-toolbar">
        <label className="management-search span-2">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search action, user or metadata" />
        </label>
        <select value={filters.entityType} onChange={(event) => updateFilter("entityType", event.target.value)}>
          <option value="">All entities</option>
          <option value="user">User</option>
          <option value="artist">Artist</option>
          <option value="label">Label</option>
          <option value="artist_label_map">Artist-label map</option>
        </select>
        <input value={filters.action} onChange={(event) => updateFilter("action", event.target.value)} placeholder="Action key" />
      </section>

      <section className="catalog-panel management-table">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 8 }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
          </div>
        ) : data.logs.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>User</th>
                  <th>Entity</th>
                  <th>Metadata</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td><strong>{log.action.replaceAll("_", " ")}</strong></td>
                    <td>
                      {log.userName || "System"}
                      <div>{log.userEmail || "No email"}</div>
                    </td>
                    <td>
                      <span className="management-badge">{log.entityType || "record"}</span>
                      <div>{log.entityId || "Not linked"}</div>
                    </td>
                    <td>{JSON.stringify(log.metadata || {})}</td>
                    <td>{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="management-empty">No activity logs match the selected filters.</div>
        )}
      </section>

      <div className="pagination-row">
        <button className="secondary-button" type="button" disabled={filters.page <= 1} onClick={() => updateFilter("page", filters.page - 1)}>Previous</button>
        <span>Page {data.pagination.page} of {data.pagination.totalPages}</span>
        <button className="secondary-button" type="button" disabled={filters.page >= data.pagination.totalPages} onClick={() => updateFilter("page", filters.page + 1)}>Next</button>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default ActivityLogs;
