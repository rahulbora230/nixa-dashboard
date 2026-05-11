import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { artistService } from "../../services/artistService";
import { labelService } from "../../services/labelService";
import { userService } from "../../services/userService";
import "../management/Management.css";

const emptyForm = {
  userId: "",
  labelId: "",
  artistName: "",
  legalName: "",
  email: "",
  phone: "",
  country: "",
  address: "",
  pan: "",
  gstNumber: "",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  upiId: "",
  paymentMethod: "bank_transfer",
  status: "active",
  notes: "",
};

const CreateArtist = () => {
  const [form, setForm] = useState(emptyForm);
  const [users, setUsers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const loadOptions = useCallback(async () => {
    try {
      const [userResult, labelResult] = await Promise.all([
        userService.getUsers({ role: "artist", limit: 100 }),
        labelService.getLabels({ limit: 100 }),
      ]);
      setUsers(userResult.users || []);
      setLabels(labelResult.labels || []);
    } catch {
      setUsers([]);
      setLabels([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadOptions, 0);
    return () => window.clearTimeout(timer);
  }, [loadOptions]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submitArtist = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const artist = await artistService.createArtist(form);
      setToast({ type: "success", message: "Artist profile created." });
      window.setTimeout(() => navigate(`/admin/artists/${artist.id}`), 900);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to create artist." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack management-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Create Artist</p>
          <h2>Add a profile with onboarding, tax and payout details.</h2>
          <p>Attach an existing artist login or leave it unassigned until the account is ready.</p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" to="/admin/artists">
            <ArrowLeft size={17} />
            Artists
          </Link>
        </div>
      </section>

      <form className="management-form" onSubmit={submitArtist}>
        <select value={form.userId} onChange={(event) => updateForm("userId", event.target.value)}>
          <option value="">No user assigned</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.email}</option>)}
        </select>
        <select value={form.labelId} onChange={(event) => updateForm("labelId", event.target.value)}>
          <option value="">Independent artist</option>
          {labels.map((label) => <option key={label.id} value={label.id}>{label.labelName}</option>)}
        </select>
        <input value={form.artistName} onChange={(event) => updateForm("artistName", event.target.value)} placeholder="Artist name" required />
        <input value={form.legalName} onChange={(event) => updateForm("legalName", event.target.value)} placeholder="Legal name" />
        <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="Email" />
        <input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="Phone" />
        <input value={form.country} onChange={(event) => updateForm("country", event.target.value)} placeholder="Country" />
        <input value={form.pan} onChange={(event) => updateForm("pan", event.target.value)} placeholder="PAN" />
        <input value={form.gstNumber} onChange={(event) => updateForm("gstNumber", event.target.value)} placeholder="GST number" />
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
          {saving ? "Creating..." : "Create Artist"}
        </button>
      </form>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default CreateArtist;
