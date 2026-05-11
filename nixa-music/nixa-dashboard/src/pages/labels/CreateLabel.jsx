import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { labelService } from "../../services/labelService";
import { userService } from "../../services/userService";
import "../management/Management.css";

const emptyForm = {
  userId: "",
  labelName: "",
  legalBusinessName: "",
  email: "",
  phone: "",
  country: "",
  address: "",
  gstNumber: "",
  pan: "",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  upiId: "",
  paymentMethod: "bank_transfer",
  status: "active",
  notes: "",
};

const CreateLabel = () => {
  const [form, setForm] = useState(emptyForm);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const loadUsers = useCallback(async () => {
    try {
      const result = await userService.getUsers({ role: "label", limit: 100 });
      setUsers(result.users || []);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadUsers, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submitLabel = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const label = await labelService.createLabel(form);
      setToast({ type: "success", message: "Label profile created." });
      window.setTimeout(() => navigate(`/admin/labels/${label.id}`), 900);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to create label." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack management-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Create Label</p>
          <h2>Add a label profile with business, tax and payout details.</h2>
          <p>Attach an existing label login or leave the profile unassigned during setup.</p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" to="/admin/labels">
            <ArrowLeft size={17} />
            Labels
          </Link>
        </div>
      </section>

      <form className="management-form" onSubmit={submitLabel}>
        <select value={form.userId} onChange={(event) => updateForm("userId", event.target.value)}>
          <option value="">No user assigned</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.email}</option>)}
        </select>
        <input value={form.labelName} onChange={(event) => updateForm("labelName", event.target.value)} placeholder="Label name" required />
        <input value={form.legalBusinessName} onChange={(event) => updateForm("legalBusinessName", event.target.value)} placeholder="Legal business name" />
        <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="Email" />
        <input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="Phone" />
        <input value={form.country} onChange={(event) => updateForm("country", event.target.value)} placeholder="Country" />
        <input value={form.gstNumber} onChange={(event) => updateForm("gstNumber", event.target.value)} placeholder="GST number" />
        <input value={form.pan} onChange={(event) => updateForm("pan", event.target.value)} placeholder="PAN" />
        <input value={form.bankName} onChange={(event) => updateForm("bankName", event.target.value)} placeholder="Bank name" />
        <input value={form.accountNumber} onChange={(event) => updateForm("accountNumber", event.target.value)} placeholder="Account number" />
        <input value={form.ifsc} onChange={(event) => updateForm("ifsc", event.target.value)} placeholder="IFSC" />
        <input value={form.upiId} onChange={(event) => updateForm("upiId", event.target.value)} placeholder="UPI ID" />
        <select value={form.paymentMethod} onChange={(event) => updateForm("paymentMethod", event.target.value)}>
          <option value="bank_transfer">Bank transfer</option>
          <option value="upi">UPI</option>
          <option value="paypal">PayPal</option>
          <option value="wise">Wise</option>
          <option value="razorpay">Razorpay</option>
          <option value="other">Other</option>
        </select>
        <select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="disabled">Disabled</option>
        </select>
        <textarea className="span-3" value={form.address} onChange={(event) => updateForm("address", event.target.value)} placeholder="Address" />
        <textarea className="span-3" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Notes" />
        <button className="primary-button" type="submit" disabled={saving}>
          <Save size={17} />
          {saving ? "Creating..." : "Create Label"}
        </button>
      </form>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default CreateLabel;
