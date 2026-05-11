import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, Link2, Mail, Send } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { getMarketingAssetUrl, smartLinkService } from "../../services/smartLinkService";
import { formatDate } from "../../utils/formatters";
import "../marketing/Marketing.css";

const getCountdown = (date) => {
  if (!date) {
    return "Coming soon";
  }

  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) {
    return "Available now";
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `${days}d ${hours}h`;
};

const PreSaveLanding = () => {
  const { slug } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", platform: "Spotify" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await smartLinkService.getPreSave(slug);
        setCampaign(data.campaign);
      } catch (error) {
        setToast({ type: "error", message: error.response?.data?.message || "Pre-save campaign not found." });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  const artworkUrl = getMarketingAssetUrl(campaign?.artwork_url);
  const countdown = useMemo(() => getCountdown(campaign?.release_date), [campaign?.release_date]);

  const submit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      await smartLinkService.subscribePreSave(slug, form);
      setToast({ type: "success", message: "You are on the pre-save list." });
      setForm((current) => ({ ...current, name: "", email: "" }));
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not capture pre-save." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="public-marketing-page">
        <div className="public-link-shell">
          <div className="marketing-skeleton" />
        </div>
      </main>
    );
  }

  if (!campaign) {
    return (
      <main className="public-marketing-page">
        <div className="public-link-shell">
          <div className="empty-marketing">Pre-save campaign is not available.</div>
        </div>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </main>
    );
  }

  return (
    <main className="public-marketing-page" style={{ "--public-artwork": `url(${artworkUrl})` }}>
      <div className="public-link-bg" />
      <div className="public-link-shell">
        <div className="public-brand">
          <Link2 size={16} /> Nixa Music
        </div>
        <section className="public-link-content">
          <img className="public-cover" src={artworkUrl} alt={`${campaign.release_title} artwork`} />
          <div>
            <span className="marketing-eyebrow">
              <CalendarDays size={16} /> {countdown}
            </span>
            <h1>{campaign.title}</h1>
            <p>
              {campaign.release_title} by {campaign.primary_artist}
            </p>
            <p>{formatDate(campaign.release_date)}</p>
          </div>

          <form className="public-dsp-list" onSubmit={submit}>
            <input
              className="marketing-input"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Name"
            />
            <input
              className="marketing-input"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
              required
            />
            <select
              className="marketing-select"
              value={form.platform}
              onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value }))}
            >
              <option>Spotify</option>
              <option>Apple Music</option>
              <option>YouTube</option>
            </select>
            <button type="submit" className="public-dsp-button" disabled={saving}>
              {saving ? <Mail size={16} /> : <Send size={16} />} Notify me
            </button>
          </form>

          <span className="marketing-muted">
            <CheckCircle2 size={15} /> Pre-save foundation only. DSP OAuth connection can be enabled later.
          </span>
        </section>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
};

export default PreSaveLanding;
