import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, ImageDown, Link2, Loader2, Plus, QrCode, Send } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { getMarketingAssetUrl, smartLinkService } from "../../services/smartLinkService";
import { formatDate } from "../../utils/formatters";
import "./Marketing.css";

const shareTypes = {
  story: { label: "Instagram Story", aspect: "9 / 16" },
  post: { label: "Instagram Post", aspect: "4 / 5" },
  facebook: { label: "Facebook Post", aspect: "1.91 / 1" },
  youtube: { label: "YouTube Community", aspect: "16 / 9" },
  whatsapp: { label: "WhatsApp Image", aspect: "1 / 1" },
};

const downloadDataUrl = (dataUrl, filename) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const PromoKit = () => {
  const { releaseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetReleaseId = releaseId || searchParams.get("releaseId");
  const cardRef = useRef(null);
  const [kit, setKit] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [shareType, setShareType] = useState("post");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [preSaveSaving, setPreSaveSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const loadKit = useCallback(async () => {
    if (!targetReleaseId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await smartLinkService.getPromoKit(targetReleaseId);
      setKit(data);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not load promo kit." });
    } finally {
      setLoading(false);
    }
  }, [targetReleaseId]);

  useEffect(() => {
    loadKit();
  }, [loadKit]);

  const shareUrl = kit?.smartLink?.public_url || kit?.public_release_url || "";
  const release = kit?.release;
  const artworkUrl = getMarketingAssetUrl(kit?.artwork_url || release?.artwork_url);

  useEffect(() => {
    if (!shareUrl) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(shareUrl, {
      margin: 1,
      width: 420,
      color: { dark: "#020617", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [shareUrl]);

  const caption = useMemo(() => {
    if (!kit?.captions) {
      return "";
    }

    return kit.captions.launch;
  }, [kit?.captions]);

  const copy = async (value, message = "Copied.") => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ type: "success", message });
    } catch {
      setToast({ type: "error", message: "Could not copy." });
    }
  };

  const createSmartLink = async () => {
    try {
      setCreating(true);
      const data = await smartLinkService.create({
        release_id: targetReleaseId,
        title: release?.title,
        description: `${release?.title} by ${release?.artist}`,
      });
      setToast({ type: "success", message: "Smart link created." });
      navigate(`/marketing/smart-links/${data.smartLink.id}`);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not create smart link." });
    } finally {
      setCreating(false);
    }
  };

  const downloadShareCard = async () => {
    if (!cardRef.current) {
      return;
    }

    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    });
    downloadDataUrl(canvas.toDataURL("image/png"), `${release?.slug || "nixa"}-${shareType}.png`);
  };

  const createPreSave = async () => {
    try {
      setPreSaveSaving(true);
      const data = await smartLinkService.createPreSave({
        release_id: targetReleaseId,
        title: `${release?.title || "Release"} pre-save`,
        release_date: release?.release_date,
        status: "active",
      });
      setToast({ type: "success", message: "Pre-save campaign created." });
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/pre-save/${data.campaign.slug}`);
      } catch {
        // Clipboard is a convenience only; campaign creation already succeeded.
      }
      loadKit();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not create pre-save campaign." });
    } finally {
      setPreSaveSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="marketing-page">
        <div className="marketing-skeleton" />
        <div className="marketing-skeleton" />
      </div>
    );
  }

  if (!targetReleaseId) {
    return (
      <div className="marketing-page">
        <div className="empty-marketing">
          <div>
            <h3>Choose a release</h3>
            <p>Open a catalog detail page and launch the promo kit from there.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div>
          <span className="marketing-eyebrow">Promo kit builder</span>
          <h1>{release?.title || "Release promo kit"}</h1>
          <p>Smart link, QR code, share card, social captions, DSP links and release copy in one workspace.</p>
        </div>
        <div className="marketing-actions">
          {kit?.smartLink ? (
            <Link className="marketing-button" to={`/marketing/smart-links/${kit.smartLink.id}`}>
              <Link2 size={17} /> Smart link
            </Link>
          ) : (
            <button type="button" className="marketing-button primary" onClick={createSmartLink} disabled={creating}>
              {creating ? <Loader2 size={17} className="spin" /> : <Plus size={17} />} Create smart link
            </button>
          )}
          {shareUrl ? (
            <a className="marketing-button" href={shareUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={17} /> Public page
            </a>
          ) : null}
        </div>
      </section>

      <div className="promo-grid">
        <section className="promo-card marketing-form-section">
          <div className="marketing-link-cell">
            <img className="marketing-artwork" src={artworkUrl} alt="" />
            <div>
              <strong>{release?.title}</strong>
              <span>{release?.artist}</span>
              <span>{formatDate(release?.release_date)}</span>
            </div>
          </div>

          <div className="qr-card">
            {qrDataUrl ? <img src={qrDataUrl} alt="Promo QR code" /> : null}
            <div className="share-actions">
              <button type="button" className="marketing-button" onClick={() => copy(shareUrl, "Link copied.")}>
                <Copy size={16} /> Copy link
              </button>
              {qrDataUrl ? (
                <button type="button" className="marketing-button" onClick={() => downloadDataUrl(qrDataUrl, `${release?.slug || "nixa"}-qr.png`)}>
                  <Download size={16} /> QR PNG
                </button>
              ) : null}
            </div>
          </div>

          <div className="caption-box">
            <span className="marketing-label">Release info</span>
            <p>
              {release?.title} by {release?.artist}. UPC {release?.upc || "pending"}. Release date{" "}
              {formatDate(release?.release_date)}.
            </p>
          </div>

          <div className="caption-box">
            <span className="marketing-label">Caption</span>
            <p>{caption}</p>
            <button type="button" className="marketing-button" onClick={() => copy(caption, "Caption copied.")}>
              <Copy size={16} /> Copy caption
            </button>
          </div>

          <div className="dsp-grid">
            {(kit?.platforms || []).map((platform) => (
              <a className="dsp-button" href={platform.url} target="_blank" rel="noreferrer" key={platform.id || platform.platform}>
                {platform.button_text || `Listen on ${platform.platform}`}
              </a>
            ))}
          </div>

          <div className="caption-box">
            <span className="marketing-label">Pre-save foundation</span>
            {(kit?.preSaveCampaigns || []).length ? (
              (kit.preSaveCampaigns || []).map((campaign) => (
                <p key={campaign.id}>
                  {campaign.title} - /pre-save/{campaign.slug}
                </p>
              ))
            ) : (
              <p>No pre-save campaign is active for this release.</p>
            )}
            <button type="button" className="marketing-button" onClick={createPreSave} disabled={preSaveSaving}>
              {preSaveSaving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Create pre-save shell
            </button>
          </div>
        </section>

        <aside className="promo-card marketing-form-section">
          <div className="marketing-panel-header">
            <div>
              <h2>Share card</h2>
              <p className="marketing-muted">Download ready-to-post artwork with QR and campaign link.</p>
            </div>
          </div>

          <select className="marketing-select" value={shareType} onChange={(event) => setShareType(event.target.value)}>
            {Object.entries(shareTypes).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>

          <div
            ref={cardRef}
            className="share-card-preview"
            style={{
              "--share-card-artwork": `url(${artworkUrl})`,
              aspectRatio: shareTypes[shareType].aspect,
            }}
          >
            <img src={artworkUrl} alt="" />
            <div>
              <span className="marketing-eyebrow">Out now</span>
              <h2>{release?.title}</h2>
              <p>{release?.artist}</p>
              {qrDataUrl ? <img src={qrDataUrl} alt="" /> : null}
            </div>
          </div>

          <div className="promo-action-grid">
            <button type="button" className="marketing-button primary" onClick={downloadShareCard}>
              <ImageDown size={16} /> Download card
            </button>
            <a className="marketing-button" href={`https://wa.me/?text=${encodeURIComponent(caption)}`} target="_blank" rel="noreferrer">
              <Send size={16} /> WhatsApp
            </a>
          </div>
        </aside>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default PromoKit;
