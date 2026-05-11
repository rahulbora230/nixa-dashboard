import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Save } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { userService } from "../../services/userService";
import { formatDate } from "../../utils/formatters";
import "../management/Management.css";

const UserDetails = () => {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const result = await userService.getUser(id);
      setUser(result);
      setForm({
        name: result.name || "",
        email: result.email || "",
        phone: result.phone || "",
        role: result.role || "artist",
        status: result.status || "active",
      });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load user." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(loadUser, 0);
    return () => window.clearTimeout(timer);
  }, [loadUser]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submitUser = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const result = await userService.updateUser(id, form);
      setUser((current) => ({ ...current, ...result }));
      setToast({ type: "success", message: "User updated." });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update user." });
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    try {
      const result = await userService.resetPassword(id);
      setToast({ type: "success", message: `Temporary password: ${result.temporaryPassword}` });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to reset password." });
    }
  };

  if (loading || !form) {
    return (
      <div className="page-stack management-workspace">
        <div className="catalog-skeleton revenue-skeleton-wrap">
          {Array.from({ length: 5 }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack management-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">User Details</p>
          <h2>{user?.name || "User profile"}</h2>
          <p>Update role, status and contact details, or reset onboarding credentials.</p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" to="/admin/users">
            <ArrowLeft size={17} />
            Users
          </Link>
          <button className="secondary-button" type="button" onClick={resetPassword}>
            <KeyRound size={17} />
            Reset Password
          </button>
        </div>
      </section>

      <section className="management-grid">
        <form className="management-form" onSubmit={submitUser}>
          <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Name" required />
          <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="Email" required />
          <input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="Phone" />
          <select value={form.role} onChange={(event) => updateForm("role", event.target.value)}>
            <option value="artist">Artist</option>
            <option value="label">Label</option>
            <option value="accountant">Accountant</option>
            <option value="admin">Admin</option>
          </select>
          <select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="disabled">Disabled</option>
          </select>
          <button className="primary-button" type="submit" disabled={saving}>
            <Save size={17} />
            {saving ? "Saving..." : "Save User"}
          </button>
        </form>

        <article className="panel">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Account Links</h3>
              <p>Connected artist or label profiles</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Artist</dt>
              <dd>{user?.artistName || "Not assigned"}</dd>
            </div>
            <div>
              <dt>Label</dt>
              <dd>{user?.labelName || "Not assigned"}</dd>
            </div>
            <div>
              <dt>Last Login</dt>
              <dd>{formatDate(user?.lastLogin)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(user?.createdAt)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading compact-heading">
          <div>
            <h3>Activity</h3>
            <p>Recent account actions</p>
          </div>
        </div>
        <div className="activity-feed">
          {user?.activity?.length ? user.activity.map((item) => (
            <div className="activity-row" key={item.id}>
              <div>
                <strong>{item.action.replaceAll("_", " ")}</strong>
                <span>{item.entityType}</span>
              </div>
              <small>{formatDate(item.createdAt)}</small>
            </div>
          )) : <div className="management-empty">No activity recorded for this user yet.</div>}
        </div>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default UserDetails;
