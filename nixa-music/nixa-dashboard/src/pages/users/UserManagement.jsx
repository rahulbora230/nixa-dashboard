import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Plus, RefreshCw, Search, UserRoundCog } from "lucide-react";
import ConfirmModal from "../../components/ui/ConfirmModal";
import Toast from "../../components/ui/Toast";
import { userService } from "../../services/userService";
import { formatDate } from "../../utils/formatters";
import "../management/Management.css";

const UserManagement = () => {
  const [filters, setFilters] = useState({ search: "", role: "", status: "", sort: "created", page: 1, limit: 12 });
  const [data, setData] = useState({ users: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [pendingUser, setPendingUser] = useState(null);
  const [toast, setToast] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await userService.getUsers(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load users." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadUsers, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  const resetPassword = async (user) => {
    try {
      const result = await userService.resetPassword(user.id);
      setToast({ type: "success", message: `Temporary password: ${result.temporaryPassword}` });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to reset password." });
    }
  };

  const toggleStatus = async () => {
    if (!pendingUser) {
      return;
    }

    try {
      const nextStatus = pendingUser.status === "active" ? "disabled" : "active";
      await userService.updateStatus(pendingUser.id, nextStatus);
      setToast({ type: "success", message: `User ${nextStatus === "active" ? "enabled" : "disabled"}.` });
      setPendingUser(null);
      loadUsers();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update user status." });
    }
  };

  return (
    <div className="page-stack management-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">User Management</p>
          <h2>Manage user access, roles, status and account recovery.</h2>
          <p>Control admin, artist, label and accountant accounts without touching catalog or finance history.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadUsers}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <Link className="primary-button" to="/admin/users/new">
            <Plus size={17} />
            Create User
          </Link>
        </div>
      </section>

      <section className="management-toolbar">
        <label className="management-search span-2">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search name, email, phone" />
        </label>
        <select value={filters.role} onChange={(event) => updateFilter("role", event.target.value)}>
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="artist">Artist</option>
          <option value="label">Label</option>
          <option value="accountant">Accountant</option>
        </select>
        <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="pending">Pending</option>
        </select>
        <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
          <option value="created">Newest</option>
          <option value="name">Name</option>
          <option value="role">Role</option>
          <option value="status">Status</option>
          <option value="lastLogin">Last login</option>
        </select>
      </section>

      <section className="catalog-panel management-table">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 7 }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
          </div>
        ) : data.users.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <div>{user.email}</div>
                    </td>
                    <td>{user.phone || "Not set"}</td>
                    <td><span className={`management-badge ${user.role}`}>{user.role}</span></td>
                    <td><span className={`management-badge ${user.status}`}>{user.status}</span></td>
                    <td>{formatDate(user.lastLogin)}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="management-actions">
                        <Link to={`/admin/users/${user.id}`}>
                          <UserRoundCog size={14} />
                          Details
                        </Link>
                        <button type="button" onClick={() => resetPassword(user)}>
                          <KeyRound size={14} />
                          Reset
                        </button>
                        <button type="button" onClick={() => setPendingUser(user)}>
                          {user.status === "active" ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="management-empty">No users match the selected filters.</div>
        )}
      </section>

      <div className="pagination-row">
        <button className="secondary-button" type="button" disabled={filters.page <= 1} onClick={() => updateFilter("page", filters.page - 1)}>Previous</button>
        <span>Page {data.pagination.page} of {data.pagination.totalPages}</span>
        <button className="secondary-button" type="button" disabled={filters.page >= data.pagination.totalPages} onClick={() => updateFilter("page", filters.page + 1)}>Next</button>
      </div>

      <ConfirmModal
        open={Boolean(pendingUser)}
        title={pendingUser?.status === "active" ? "Disable user" : "Enable user"}
        message={`This will ${pendingUser?.status === "active" ? "disable" : "enable"} ${pendingUser?.name || "this user"}.`}
        confirmLabel={pendingUser?.status === "active" ? "Disable" : "Enable"}
        tone={pendingUser?.status === "active" ? "danger" : "success"}
        onConfirm={toggleStatus}
        onCancel={() => setPendingUser(null)}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default UserManagement;
