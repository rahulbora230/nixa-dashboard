import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { artistService } from "../../services/artistService";
import { labelService } from "../../services/labelService";
import { userService } from "../../services/userService";
import { formatCurrency, formatDate, formatNumber } from "../../utils/formatters";
import "../management/Management.css";

const ArtistDetails = () => {
  const { id } = useParams();
  const [artist, setArtist] = useState(null);
  const [form, setForm] = useState(null);
  const [users, setUsers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const loadArtist = useCallback(async () => {
    try {
      setLoading(true);
      const [artistResult, userResult, labelResult] = await Promise.all([
        artistService.getArtist(id),
        userService.getUsers({ role: "artist", limit: 100 }),
        labelService.getLabels({ limit: 100 }),
      ]);
      setArtist(artistResult);
      setUsers(userResult.users || []);
      setLabels(labelResult.labels || []);
      setForm({
        userId: artistResult.userId || "",
        labelId: artistResult.labelId || "",
        artistName: artistResult.artistName || "",
        legalName: artistResult.legalName || "",
        email: artistResult.email || "",
        phone: artistResult.phone || "",
        country: artistResult.country || "",
        address: artistResult.address || "",
        pan: artistResult.pan || "",
        gstNumber: artistResult.gstNumber || "",
        bankName: artistResult.bankName || "",
        accountNumber: artistResult.accountNumber || "",
        ifsc: artistResult.ifsc || "",
        upiId: artistResult.upiId || "",
        paymentMethod: artistResult.paymentMethod || "bank_transfer",
        status: artistResult.status || "active",
        notes: artistResult.notes || "",
      });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load artist." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(loadArtist, 0);
    return () => window.clearTimeout(timer);
  }, [loadArtist]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submitArtist = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const result = await artistService.updateArtist(id, form);
      setArtist(result);
      setToast({ type: "success", message: "Artist profile updated." });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update artist." });
    } finally {
      setSaving(false);
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
          <p className="eyebrow">Artist Details</p>
          <h2>{artist?.artistName}</h2>
          <p>Manage profile ownership, label assignment, finance identity, tax and payment details.</p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" to="/admin/artists">
            <ArrowLeft size={17} />
            Artists
          </Link>
        </div>
      </section>

      <section className="stats-grid four-columns">
        <article className="metric-card cyan-card">
          <span>Gross Revenue</span>
          <strong>{formatCurrency(artist?.grossRevenue)}</strong>
          <p>{formatNumber(artist?.totalStreams)} streams</p>
        </article>
        <article className="metric-card purple-card">
          <span>Pending Payable</span>
          <strong>{formatCurrency(artist?.pendingAmount)}</strong>
          <p>{formatCurrency(artist?.paidAmount)} paid</p>
        </article>
        <article className="metric-card magenta-card">
          <span>Catalog</span>
          <strong>{formatNumber(artist?.releaseCount)}</strong>
          <p>Linked releases</p>
        </article>
        <article className="metric-card green-card">
          <span>Payouts</span>
          <strong>{formatNumber(artist?.payoutCount)}</strong>
          <p>Processed records</p>
        </article>
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
          {saving ? "Saving..." : "Save Artist"}
        </button>
      </form>

      <section className="dashboard-grid lower-grid">
        <article className="panel management-table">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Catalog</h3>
              <p>Recent linked releases</p>
            </div>
          </div>
          {artist?.catalog?.length ? (
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
                  {artist.catalog.map((release) => (
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
          ) : <div className="management-empty">No linked catalog yet.</div>}
        </article>

        <article className="panel">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Payouts</h3>
              <p>Recent payout activity</p>
            </div>
          </div>
          <div className="activity-feed">
            {artist?.payouts?.length ? artist.payouts.map((payout) => (
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

export default ArtistDetails;
