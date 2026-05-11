import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { profileService } from "../../services/profileService";
import { formatDate } from "../../utils/formatters";
import "../management/Management.css";

const MyProfile = () => {
  const { role } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await profileService.getMyProfile();
      const entity = result.artist || result.label || {};
      setProfile(result);
      setForm({
        name: result.user?.name || "",
        email: result.user?.email || entity.email || "",
        phone: result.user?.phone || entity.phone || "",
        country: entity.country || "",
        address: entity.address || "",
        pan: entity.pan || "",
        gstNumber: entity.gstNumber || "",
        bankName: entity.bankName || "",
        accountNumber: entity.accountNumber || "",
        ifsc: entity.ifsc || "",
        upiId: entity.upiId || "",
        paymentMethod: entity.paymentMethod || "bank_transfer",
        notes: entity.notes || "",
      });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load profile." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadProfile, 0);
    return () => window.clearTimeout(timer);
  }, [loadProfile]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submitProfile = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const result = await profileService.updateMyProfile(form);
      setProfile(result);
      setToast({ type: "success", message: "Profile update saved." });
      loadProfile();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update profile." });
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
          <p className="eyebrow">My Profile</p>
          <h2>{profile?.artist?.artistName || profile?.label?.labelName || profile?.user?.name}</h2>
          <p>View account, tax and payment details used for catalog ownership, statements and payout invoices.</p>
        </div>
      </section>

      <section className="profile-grid">
        <form className="profile-form" onSubmit={submitProfile}>
          <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Name" required />
          <input type="email" value={form.email} disabled placeholder="Email" />
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
          <textarea className="span-3" value={form.address} onChange={(event) => updateForm("address", event.target.value)} placeholder="Address" />
          <textarea className="span-3" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Update request notes" />
          <button className="primary-button" type="submit" disabled={saving}>
            <Save size={17} />
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>

        <article className="panel">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Account</h3>
              <p>Role and onboarding status</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Role</dt>
              <dd><span className={`management-badge ${role}`}>{role}</span></dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd><span className={`management-badge ${profile?.user?.status}`}>{profile?.user?.status}</span></dd>
            </div>
            <div>
              <dt>Last Login</dt>
              <dd>{formatDate(profile?.user?.lastLogin)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(profile?.user?.createdAt)}</dd>
            </div>
          </dl>

          {profile?.assignedArtists?.length ? (
            <>
              <div className="panel-heading compact-heading">
                <div>
                  <h3>Assigned Artists</h3>
                  <p>Artists attached to this label</p>
                </div>
              </div>
              <div className="activity-feed">
                {profile.assignedArtists.map((artist) => (
                  <div className="activity-row" key={artist.id}>
                    <div>
                      <strong>{artist.artistName}</strong>
                      <span>{artist.email || artist.country || "Roster artist"}</span>
                    </div>
                    <small>{artist.assignmentStatus}</small>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default MyProfile;
