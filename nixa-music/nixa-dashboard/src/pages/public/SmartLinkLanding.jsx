import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { Camera, Copy, ExternalLink, Link2, QrCode, Send, Share2 } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { getMarketingAssetUrl, smartLinkService } from "../../services/smartLinkService";
import "../marketing/Marketing.css";

const SmartLinkLanding = () => {
  const { slug } = useParams();
  const [smartLink, setSmartLink] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await smartLinkService.getBySlug(slug);
        setSmartLink(data.smartLink);
      } catch (error) {
        setToast({ type: "error", message: error.response?.data?.message || "Smart link not found." });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  useEffect(() => {
    if (!smartLink?.public_url) {
      return;
    }

    QRCode.toDataURL(smartLink.public_url, {
      margin: 1,
      width: 320,
      color: { dark: "#020617", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [smartLink?.public_url]);

  const artworkUrl = getMarketingAssetUrl(smartLink?.artwork_url || smartLink?.release?.artwork_url);
  const caption = useMemo(() => {
    if (!smartLink) {
      return "";
    }
    return `Listen to ${smartLink.title} by ${smartLink.release?.artist || "Nixa Music"}: ${smartLink.public_url}`;
  }, [smartLink]);

  const clickPlatform = async (platform) => {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    try {
      const result = await smartLinkService.trackClick(slug, {
        platform_id: platform.id,
        platform: platform.platform,
        referrer: document.referrer,
      });

      if (popup) {
        popup.location.href = result.url || platform.url;
      } else {
        window.location.href = result.url || platform.url;
      }
    } catch {
      if (popup) {
        popup.location.href = platform.url;
      } else {
        window.location.href = platform.url;
      }
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

  if (loading) {
    return (
      <main className="public-marketing-page">
        <div className="public-link-shell">
          <div className="marketing-skeleton" />
        </div>
      </main>
    );
  }

  if (!smartLink) {
    return (
      <main className="public-marketing-page">
        <div className="public-link-shell">
          <div className="empty-marketing">This smart link is not available.</div>
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
          <img className="public-cover" src={artworkUrl} alt={`${smartLink.title} artwork`} />
          <div>
            <h1>{smartLink.title}</h1>
            <p>{smartLink.release?.artist || smartLink.release?.title}</p>
          </div>

          <div className="public-dsp-list">
            {(smartLink.platforms || []).map((platform) => (
              <button
                type="button"
                className="public-dsp-button"
                key={platform.id || platform.platform}
                onClick={() => clickPlatform(platform)}
              >
                {platform.button_text || `Listen on ${platform.platform}`} <ExternalLink size={16} />
              </button>
            ))}
          </div>

          <div className="public-qr-card">
            {qrDataUrl ? <img src={qrDataUrl} alt="Smart link QR code" /> : <QrCode size={58} />}
            <span className="marketing-muted">Scan or share this Nixa Music link</span>
          </div>

          <div className="public-share-row">
            <button type="button" className="marketing-button" onClick={() => copy(smartLink.public_url, "Link copied.")}>
              <Copy size={16} />
            </button>
            <a className="marketing-button" href={`https://wa.me/?text=${encodeURIComponent(caption)}`} target="_blank" rel="noreferrer">
              <Send size={16} />
            </a>
            <a
              className="marketing-button"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(smartLink.public_url)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 size={16} />
            </a>
            <button type="button" className="marketing-button" onClick={() => copy(caption, "Caption copied.")}>
              <Camera size={16} />
            </button>
          </div>
        </section>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
};

export default SmartLinkLanding;
