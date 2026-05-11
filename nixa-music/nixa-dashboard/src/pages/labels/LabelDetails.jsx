import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { artistService } from "../../services/artistService";
import { labelService } from "../../services/labelService";
import { userService } from "../../services/userService";
import { formatCurrency, formatDate, formatNumber } from "../../utils/formatters";
import "../management/Management.css";

const LabelDetails = () => {
  const { id } = useParams();
  const [label, setLabel] = useState(null);
  const [form, setForm] = useState(null);
  const [users, setUsers] = useState([]);
  const [artists, setArtists] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const loadLabel = useCallback(async () => {
    try {
      setLoading(true);
      const [labelResult, userResult, artistResult] = await Promise.all([
        labelService.getLabel(id),
        userService.getUsers({ role: "label", limit: 100 }),
        artistService.getArtists({ limit: 100, sort: "name" }),
      ]);
      setLabel(labelResult);
      setUsers(userResult.users || []);
      setArtists(artistResult.artists || []);
      setForm({
        userId: labelResult.userId || "",
        labelName: labelResult.labelName || "",
        legalBusinessName: labelResult.legalBusinessName || "",
        email: labelResult.email || "",
        phone: labelResult.phone || "",
        country: labelResult.country || "",
        address: labelResult.address || "",
        gstNumber: labelResult.gstNumber || "",
        pan: labelResult.pan || "",
        bankName: labelResult.bankName || "",
        accountNumber: labelResult.accountNumber || "",
        ifsc: labelResult.ifsc || "",
        upiId: labelResult.upiId || "",
        paymentMethod: labelResult.paymentMethod || "bank_transfer",
        status: labelResult.status || "active",
        notes: labelResult.notes || "",
      });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load label." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(loadLabel, 0);
    return () => window.clearTimeout(timer);
  }, [loadLabel]);

  const activeArtistIds = useMemo(
    () => new Set((label?.artists || []).filter((artist) => artist.assignmentStatus === "active").map((artist) => artist.id)),
    [label]
  );

  const availableArtists = useMemo(
    () => artists.filter((artist) => !activeArtistIds.has(artist.id)),
    [activeArtistIds, artists]
  );

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submitLabel = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const result = await labelService.updateLabel(id, form);
      setLabel(result);
      setToast({ type: "success", message: "Label profile updated." });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update label." });
    } finally {
      setSaving(false);
    }
  };

  const assignArtist = async (event) => {
    event.preventDefault();

    if (!selectedArtist) {
      return;
    }

    try {
      await labelService.assignArtist(id, selectedArtist);
      setSelectedArtist("");
      setToast({ type: "success", message: "Artist assigned to label." });
      loadLabel();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to assign artist." });
    }
  };

  const removeArtist = async (artistId) => {
    try {
      await labelService.removeArtist(id, artistId);
      setToast({ type: "success", message: "Artist removed from label." });
      loadLabel();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to remove artist." });
    }
  };

  if (loading || !form) {
    return (
      <div className="page-stack management-workspace">
        <div className="catalog-skeleton revenue-skeleton-wrap">
          {Array.from({ length: 6 }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack management-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Label Details</p>
          <h2>{label?.labelName}</h2>
          <p>Manage business identity, label user account, tax details and artist roster.</p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" to="/admin/labels">
            <ArrowLeft size={17} />
            Labels
          </Link>
        </div>
      </section>

      <section className="stats-grid four-columns">
        <article className="metric-card cyan-card">
          <span>Gross Revenue</span>
          <strong>{formatCurrency(label?.grossRevenue)}</strong>
          <p>{formatNumber(label?.totalStreams)} streams</p>
        </article>
        <article className="metric-card purple-card">
          <span>Pending Payable</span>
          <strong>{formatCurrency(label?.pendingAmount)}</strong>
          <p>{formatCurrency(label?.paidAmount)} paid</p>
        </article>
        <article className="metric-card magenta-card">
          <span>Roster</span>
          <strong>{formatNumber(label?.artistCount)}</strong>
          <p>Assigned artists</p>
        </article>
        <article className="metric-card green-card">
          <span>Payouts</span>
          <strong>{formatNumber(label?.payoutCount)}</strong>
          <p>Processed records</p>
        </article>
      </section>

      <section className="management-grid">
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
            {saving ? "Saving..." : "Save Label"}
          </button>
        </form>

        <article className="panel">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Assign Artist</h3>
              <p>Add artists to this label roster</p>
            </div>
          </div>
          <form className="assignment-form" onSubmit={assignArtist}>
            <select value={selectedArtist} onChange={(event) => setSelectedArtist(event.target.value)}>
              <option value="">Select artist</option>
              {availableArtists.map((artist) => <option key={artist.id} value={artist.id}>{artist.artistName}</option>)}
            </select>
            <button type="submit">
              <UserPlus size={14} />
              Assign
            </button>
          </form>
          <div className="activity-feed">
            {label?.artists?.length ? label.artists.map((artist) => (
              <div className="activity-row" key={artist.assignmentId || artist.id}>
                <div>
                  <strong>{artist.artistName}</strong>
                  <span>{artist.assignmentStatus} since {formatDate(artist.assignedAt)}</span>
                </div>
                {artist.assignmentStatus === "active" ? (
                  <button className="secondary-button" type="button" onClick={() => removeArtist(artist.id)}>Remove</button>
                ) : (
                  <small>{formatDate(artist.removedAt)}</small>
                )}
              </div>
            )) : <div className="management-empty">No artists assigned yet.</div>}
          </div>
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel management-table">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Catalog</h3>
              <p>Recent label releases</p>
            </div>
          </div>
          {label?.catalog?.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Release Date</th>
                  </tr>
                </thead>
                <tbody>
                  {label.catalog.map((release) => (
                    <tr key={release.id}>
                      <td>{release.title}</td>
                      <td>{release.release_type || "Release"}</td>
                      <td><span className={`management-badge ${release.status}`}>{release.status}</span></td>
                      <td>{formatDate(release.release_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="management-empty">No linked label catalog yet.</div>}
        </article>

        <article className="panel">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Payouts</h3>
              <p>Recent label payouts</p>
            </div>
          </div>
          <div className="activity-feed">
            {label?.payouts?.length ? label.payouts.map((payout) => (
              <div className="activity-row" key={payout.id}>
                <div>
                  <strong>{formatCurrency(payout.net_amount)}</strong>
                  <span>{payout.status} via {payout.payment_method || "manual"}</span>
                </div>
                <small>{formatDate(payout.payout_date || payout.created_at)}</small>
              </div>
            )) : <div className="management-empty">No payouts processed yet.</div>}
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default LabelDetails;
