import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { Copy, ExternalLink, Link2, Music2, Send, Share2 } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { getMarketingAssetUrl, smartLinkService } from "../../services/smartLinkService";
import { formatDate } from "../../utils/formatters";
import "../marketing/Marketing.css";

const PublicReleasePage = () => {
  const { releaseSlug, trackSlug } = useParams();
  const [data, setData] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await smartLinkService.getPublicRelease(releaseSlug, trackSlug);
        setData(response);
      } catch (error) {
        setToast({ type: "error", message: error.response?.data?.message || "Release page not found." });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [releaseSlug, trackSlug]);

  const release = data?.release;
  const track = data?.track;
  const artworkUrl = getMarketingAssetUrl(release?.artwork_url);
  const shareUrl = data?.smartLink?.public_url || release?.public_url || window.location.href;
  const title = track?.title || release?.title;
  const caption = useMemo(() => {
    if (!release) {
      return "";
    }
    return `Listen to ${title} by ${release.artist}: ${shareUrl}`;
  }, [release, shareUrl, title]);

  useEffect(() => {
    if (!shareUrl) {
      return;
    }

    QRCode.toDataURL(shareUrl, {
      margin: 1,
      width: 320,
      color: { dark: "#020617", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [shareUrl]);

  const copy = async (value, message = "Copied.") => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ type: "success", message });
    } catch {
      setToast({ type: "error", message: "Could not copy." });
    }
  };

  const openPlatform = async (platform) => {
    if (!data?.smartLink?.slug) {
      window.open(platform.url, "_blank", "noopener,noreferrer");
      return;
    }

    const popup = window.open("", "_blank", "noopener,noreferrer");
    try {
      const result = await smartLinkService.trackClick(data.smartLink.slug, {
        platform_id: platform.id,
        platform: platform.platform,
        referrer: document.referrer,
      });
      if (popup) {
        popup.location.href = result.url || platform.url;
      }
    } catch {
      if (popup) {
        popup.location.href = platform.url;
      }
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

  if (!data) {
    return (
      <main className="public-marketing-page">
        <div className="public-link-shell">
          <div className="empty-marketing">Release page is not available.</div>
        </div>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </main>
    );
  }

  return (
    <main className="public-marketing-page" style={{ "--public-artwork": `url(${artworkUrl})` }}>
      <div className="public-link-bg" />
      <section className="public-release-grid">
        <aside className="public-link-content">
          <div className="public-brand">
            <Link2 size={16} /> Nixa Music
          </div>
          <img className="public-cover" src={artworkUrl} alt={`${release.title} artwork`} />
          <div>
            <h1>{title}</h1>
            <p>{release.artist}</p>
            <p>{formatDate(release.release_date)}</p>
          </div>
          <div className="public-qr-card">
            {qrDataUrl ? <img src={qrDataUrl} alt="Release QR code" /> : null}
          </div>
          <div className="public-share-row">
            <button type="button" className="marketing-button" onClick={() => copy(shareUrl, "Link copied.")}>
              <Copy size={16} />
            </button>
            <a className="marketing-button" href={`https://wa.me/?text=${encodeURIComponent(caption)}`} target="_blank" rel="noreferrer">
              <Send size={16} />
            </a>
            <a
              className="marketing-button"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 size={16} />
            </a>
            <button type="button" className="marketing-button" onClick={() => copy(caption, "Caption copied.")}>
              <Music2 size={16} />
            </button>
          </div>
        </aside>

        <section className="public-link-content">
          <h2>Listen now</h2>
          <div className="public-dsp-list">
            {(data.platforms || []).map((platform) => (
              <button
                type="button"
                className="public-dsp-button"
                key={platform.id || platform.platform}
                onClick={() => openPlatform(platform)}
              >
                {platform.button_text || `Listen on ${platform.platform}`} <ExternalLink size={16} />
              </button>
            ))}
          </div>

          {data.tracks?.length ? (
            <div className="public-release-list">
              {data.tracks.map((item) => (
                <Link className="public-release-item" to={`/release/${release.slug}/${item.slug}`} key={item.id}>
                  <img src={artworkUrl} alt="" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.isrc}</p>
                  </div>
                  <ExternalLink size={16} />
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </section>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
};

export default PublicReleasePage;
