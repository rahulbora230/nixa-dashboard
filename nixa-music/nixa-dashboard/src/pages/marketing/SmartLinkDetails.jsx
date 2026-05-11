import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Send,
  Share2,
  Trash2,
} from "lucide-react";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { getMarketingAssetUrl, smartLinkService } from "../../services/smartLinkService";
import { formatDate, formatNumber } from "../../utils/formatters";
import "./Marketing.css";

const createEmptyPlatform = (index = 0) => ({
  platform: "",
  url: "",
  button_text: "",
  display_order: index + 1,
  is_active: true,
});

const downloadBlob = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const downloadDataUrl = (dataUrl, filename) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const SmartLinkDetails = () => {
  const { id } = useParams();
  const { role } = useAuth();
  const [smartLink, setSmartLink] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState({ title: "", slug: "", description: "", status: "active" });
  const [platformDrafts, setPlatformDrafts] = useState([]);
  const [newPlatform, setNewPlatform] = useState(createEmptyPlatform());
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const canEdit = ["admin", "artist", "label"].includes(role);

  const loadDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [detailData, analyticsData] = await Promise.all([
        smartLinkService.get(id),
        smartLinkService.getAnalytics(id),
      ]);
      const link = detailData.smartLink;
      setSmartLink(link);
      setAnalytics(analyticsData);
      setForm({
        title: link.title || "",
        slug: link.slug || "",
        description: link.description || "",
        status: link.status || "active",
      });
      setPlatformDrafts(link.platforms || []);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not load smart link." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    if (!smartLink?.public_url) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(smartLink.public_url, {
      margin: 1,
      width: 420,
      color: { dark: "#020617", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [smartLink?.public_url]);

  const summary = analytics?.summary || {};
  const caption = useMemo(() => {
    if (!smartLink) {
      return "";
    }

    return `Listen to ${smartLink.title} by ${smartLink.release?.artist || "Nixa Music"}: ${smartLink.public_url}`;
  }, [smartLink]);

  const saveDetails = async () => {
    try {
      setSaving(true);
      const data = await smartLinkService.update(id, {
        ...form,
        platforms: platformDrafts,
      });
      setSmartLink(data.smartLink);
      setPlatformDrafts(data.smartLink.platforms || []);
      setToast({ type: "success", message: "Smart link updated." });
      loadDetails();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not update smart link." });
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (index, key, value) => {
    setPlatformDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const addPlatform = async () => {
    try {
      const data = await smartLinkService.addPlatform(id, newPlatform);
      setPlatformDrafts(data.platforms || []);
      setNewPlatform(createEmptyPlatform((data.platforms || []).length));
      setToast({ type: "success", message: "Platform button added." });
      loadDetails();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not add platform." });
    }
  };

  const removePlatform = async (platformId) => {
    try {
      const data = await smartLinkService.removePlatform(id, platformId);
      setPlatformDrafts(data.platforms || []);
      setToast({ type: "success", message: "Platform removed." });
      loadDetails();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not remove platform." });
    }
  };

  const copy = async (value, message = "Copied.") => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ type: "success", message });
    } catch {
      setToast({ type: "error", message: "Could not copy." });
    }
  };

  const downloadSvg = async () => {
    const svg = await QRCode.toString(smartLink.public_url, {
      type: "svg",
      margin: 1,
      color: { dark: "#020617", light: "#ffffff" },
    });
    downloadBlob(svg, `${smartLink.slug}-qr.svg`, "image/svg+xml");
  };

  if (loading) {
    return (
      <div className="marketing-page">
        <div className="marketing-skeleton" />
        <div className="marketing-skeleton" />
      </div>
    );
  }

  if (!smartLink) {
    return (
      <div className="marketing-page">
        <div className="empty-marketing">Smart link not found.</div>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div>
          <span className="marketing-eyebrow">Smart link details</span>
          <h1>{smartLink.title}</h1>
          <p>{smartLink.public_url}</p>
        </div>
        <div className="marketing-actions">
          <Link className="marketing-button" to="/marketing/smart-links">
            <ArrowLeft size={17} /> Back
          </Link>
          <a className="marketing-button" href={smartLink.public_url} target="_blank" rel="noreferrer">
            <ExternalLink size={17} /> Open
          </a>
          <button type="button" className="marketing-button" onClick={() => copy(smartLink.public_url, "Smart link copied.")}>
            <Copy size={17} /> Copy
          </button>
        </div>
      </section>

      <section className="marketing-grid">
        <article className="marketing-stat-card">
          <span>Total clicks</span>
          <strong>{formatNumber(summary.total_clicks)}</strong>
        </article>
        <article className="marketing-stat-card">
          <span>Unique visitors</span>
          <strong>{formatNumber(summary.unique_visitors)}</strong>
        </article>
        <article className="marketing-stat-card">
          <span>DSP click rate</span>
          <strong>{summary.conversion_rate || 0}%</strong>
        </article>
        <article className="marketing-stat-card">
          <span>Last click</span>
          <strong>{summary.last_click_at ? formatDate(summary.last_click_at) : "None"}</strong>
        </article>
      </section>

      <div className="promo-grid">
        <section className="marketing-panel marketing-form-section">
          <div className="marketing-panel-header">
            <div>
              <h2>Landing page settings</h2>
              <p className="marketing-muted">Updates affect the public page immediately when the link is active.</p>
            </div>
            {canEdit ? (
              <button type="button" className="marketing-button primary" onClick={saveDetails} disabled={saving}>
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save
              </button>
            ) : null}
          </div>

          <div className="marketing-field-grid">
            <label>
              <span className="marketing-label">Title</span>
              <input
                className="marketing-input"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                disabled={!canEdit}
              />
            </label>
            <label>
              <span className="marketing-label">Status</span>
              <select
                className="marketing-select"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                disabled={!canEdit}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
                <option value="pre_save">Pre-save ready</option>
              </select>
            </label>
          </div>

          <label>
            <span className="marketing-label">Slug</span>
            <input
              className="marketing-input"
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              disabled={!canEdit}
            />
          </label>

          <label>
            <span className="marketing-label">Description</span>
            <textarea
              className="marketing-textarea"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              disabled={!canEdit}
            />
          </label>

          <div className="marketing-panel-header">
            <div>
              <h2>DSP buttons</h2>
              <p className="marketing-muted">Spotify, Apple Music, YouTube, JioSaavn, Wynk, Amazon, Gaana, Boomplay and custom URLs.</p>
            </div>
          </div>

          <div className="platform-list">
            {platformDrafts.map((platform, index) => (
              <div className="platform-editor-row" key={platform.id || `${platform.platform}-${index}`}>
                <input
                  className="marketing-input"
                  value={platform.platform || ""}
                  onChange={(event) => updateDraft(index, "platform", event.target.value)}
                  disabled={!canEdit}
                />
                <input
                  className="marketing-input"
                  value={platform.url || ""}
                  onChange={(event) => updateDraft(index, "url", event.target.value)}
                  disabled={!canEdit}
                />
                <input
                  className="marketing-input"
                  value={platform.button_text || ""}
                  onChange={(event) => updateDraft(index, "button_text", event.target.value)}
                  disabled={!canEdit}
                />
                {canEdit ? (
                  <button type="button" className="marketing-button danger" onClick={() => removePlatform(platform.id)}>
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {canEdit ? (
            <div className="platform-editor-row">
              <input
                className="marketing-input"
                value={newPlatform.platform}
                onChange={(event) => setNewPlatform((current) => ({ ...current, platform: event.target.value }))}
                placeholder="Custom platform"
              />
              <input
                className="marketing-input"
                value={newPlatform.url}
                onChange={(event) => setNewPlatform((current) => ({ ...current, url: event.target.value }))}
                placeholder="https://..."
              />
              <input
                className="marketing-input"
                value={newPlatform.button_text}
                onChange={(event) => setNewPlatform((current) => ({ ...current, button_text: event.target.value }))}
                placeholder="Button text"
              />
              <button type="button" className="marketing-button" onClick={addPlatform}>
                <Plus size={16} />
              </button>
            </div>
          ) : null}
        </section>

        <aside className="marketing-panel marketing-form-section">
          <div className="marketing-link-cell">
            <img className="marketing-artwork" src={getMarketingAssetUrl(smartLink.artwork_url || smartLink.release?.artwork_url)} alt="" />
            <div>
              <strong>{smartLink.release?.title || smartLink.title}</strong>
              <span>{smartLink.release?.artist}</span>
            </div>
          </div>

          <div className="qr-card">
            {qrDataUrl ? <img src={qrDataUrl} alt="Smart link QR code" /> : null}
            <div className="share-actions">
              <button type="button" className="marketing-button" onClick={() => downloadDataUrl(qrDataUrl, `${smartLink.slug}-qr.png`)}>
                <Download size={16} /> PNG
              </button>
              <button type="button" className="marketing-button" onClick={downloadSvg}>
                <Download size={16} /> SVG
              </button>
            </div>
          </div>

          <div className="caption-box">
            <span className="marketing-label">Caption</span>
            <p>{caption}</p>
          </div>

          <div className="share-actions">
            <a
              className="marketing-button"
              href={`https://wa.me/?text=${encodeURIComponent(caption)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Send size={16} /> WhatsApp
            </a>
            <a
              className="marketing-button"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(smartLink.public_url)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 size={16} /> Facebook
            </a>
            <a
              className="marketing-button"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`}
              target="_blank"
              rel="noreferrer"
            >
              X
            </a>
            <button type="button" className="marketing-button" onClick={() => copy(caption, "Caption copied.")}>
              <Copy size={16} /> Instagram
            </button>
          </div>
        </aside>
      </div>

      <section className="marketing-panel">
        <div className="marketing-panel-header">
          <div>
            <h2>Click trend</h2>
            <p className="marketing-muted">Daily click activity across public DSP buttons.</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={analytics?.dailyClicks || []}>
            <XAxis dataKey="date" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,.25)" }} />
            <Area type="monotone" dataKey="clicks" stroke="#22d3ee" fill="#8b5cf6" fillOpacity={0.28} />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="marketing-grid">
        <article className="marketing-panel">
          <h3>Platform clicks</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics?.platformClicks || []}>
              <XAxis dataKey="platform" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,.25)" }} />
              <Bar dataKey="clicks" fill="#22d3ee" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <article className="marketing-panel">
          <h3>Top countries</h3>
          <div className="platform-list">
            {(analytics?.countryClicks || []).slice(0, 8).map((row) => (
              <div className="caption-box" key={row.country}>
                <strong>{row.country}</strong>
                <p>{formatNumber(row.clicks)} clicks</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default SmartLinkDetails;
