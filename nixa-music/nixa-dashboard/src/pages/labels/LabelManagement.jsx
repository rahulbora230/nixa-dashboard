import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, RefreshCw, Search } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { labelService } from "../../services/labelService";
import { formatCurrency, formatDate, formatNumber } from "../../utils/formatters";
import "../management/Management.css";

const LabelManagement = () => {
  const [filters, setFilters] = useState({ search: "", status: "", sort: "created", page: 1, limit: 12 });
  const [data, setData] = useState({ labels: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadLabels = useCallback(async () => {
    try {
      setLoading(true);
      const result = await labelService.getLabels(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load labels." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadLabels, 0);
    return () => window.clearTimeout(timer);
  }, [loadLabels]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  const toggleStatus = async (label) => {
    try {
      const nextStatus = label.status === "active" ? "disabled" : "active";
      await labelService.updateStatus(label.id, nextStatus);
      setToast({ type: "success", message: `Label ${nextStatus === "active" ? "enabled" : "disabled"}.` });
      loadLabels();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update label." });
    }
  };

  return (
    <div className="page-stack management-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Label Management</p>
          <h2>Manage label profiles, roster assignments and payout identities.</h2>
          <p>Keep legal business details, tax IDs, bank data and artist assignments in one place.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadLabels}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <Link className="primary-button" to="/admin/labels/new">
            <Plus size={17} />
            Create Label
          </Link>
        </div>
      </section>

      <section className="management-toolbar">
        <label className="management-search span-2">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search label, business name, email, country" />
        </label>
        <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="pending">Pending</option>
        </select>
        <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
          <option value="created">Newest</option>
          <option value="name">Label name</option>
          <option value="artists">Artist count</option>
          <option value="revenue">Revenue</option>
          <option value="payable">Payable</option>
        </select>
      </section>

      <section className="catalog-panel management-table">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 7 }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
          </div>
        ) : data.labels.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Artists</th>
                  <th>Revenue</th>
                  <th>Pending</th>
                  <th>Streams</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.labels.map((label) => (
                  <tr key={label.id}>
                    <td>
                      <strong>{label.labelName}</strong>
                      <div>{label.email || label.userEmail || "No email"}</div>
                    </td>
                    <td>{formatNumber(label.artistCount)}</td>
                    <td>{formatCurrency(label.grossRevenue)}</td>
                    <td>{formatCurrency(label.pendingAmount || label.payableBalance)}</td>
                    <td>{formatNumber(label.totalStreams)}</td>
                    <td><span className={`management-badge ${label.status}`}>{label.status}</span></td>
                    <td>{formatDate(label.createdAt)}</td>
                    <td>
                      <div className="management-actions">
                        <Link to={`/admin/labels/${label.id}`}>
                          <Building2 size={14} />
                          Details
                        </Link>
                        <button type="button" onClick={() => toggleStatus(label)}>
                          {label.status === "active" ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="management-empty">No labels match the selected filters.</div>
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

export default LabelManagement;
