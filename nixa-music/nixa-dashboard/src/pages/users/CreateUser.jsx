import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { userService } from "../../services/userService";
import "../management/Management.css";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: "artist",
  status: "active",
  password: "",
};

const CreateUser = () => {
  const [form, setForm] = useState(emptyForm);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submitUser = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const result = await userService.createUser(form);
      setTemporaryPassword(result.temporaryPassword);
      setToast({ type: "success", message: "User created successfully." });
      window.setTimeout(() => navigate(`/admin/users/${result.user.id}`), 1200);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to create user." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack management-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Create User</p>
          <h2>Add a secure account for artists, labels, accountants or admins.</h2>
          <p>Leave password blank to generate a temporary password for onboarding.</p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" to="/admin/users">
            <ArrowLeft size={17} />
            Users
          </Link>
        </div>
      </section>

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
        <input type="password" value={form.password} onChange={(event) => updateForm("password", event.target.value)} placeholder="Temporary password" />
        <button className="primary-button" type="submit" disabled={saving}>
          <Save size={17} />
          {saving ? "Creating..." : "Create User"}
        </button>
      </form>

      {temporaryPassword && (
        <section className="panel">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Temporary Password</h3>
              <p>Share this with the new user during onboarding.</p>
            </div>
          </div>
          <strong>{temporaryPassword}</strong>
        </section>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default CreateUser;
