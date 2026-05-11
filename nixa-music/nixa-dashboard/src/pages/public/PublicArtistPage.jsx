import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Link2, Music2 } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { getMarketingAssetUrl, smartLinkService } from "../../services/smartLinkService";
import { formatDate, formatNumber } from "../../utils/formatters";
import "../marketing/Marketing.css";

const PublicArtistPage = () => {
  const { artistSlug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await smartLinkService.getPublicArtist(artistSlug);
        setData(response);
      } catch (error) {
        setToast({ type: "error", message: error.response?.data?.message || "Artist page not found." });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [artistSlug]);

  const heroArtwork = getMarketingAssetUrl(data?.releases?.[0]?.artwork_url);

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
          <div className="empty-marketing">Artist page is not available.</div>
        </div>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </main>
    );
  }

  return (
    <main className="public-marketing-page" style={{ "--public-artwork": `url(${heroArtwork})` }}>
      <div className="public-link-bg" />
      <section className="public-release-grid">
        <aside className="public-link-content">
          <div className="public-brand">
            <Link2 size={16} /> Nixa Music
          </div>
          <Music2 size={76} />
          <div>
            <h1>{data.artist.name}</h1>
            <p>{data.artist.country || "Artist catalog"}</p>
          </div>
          <div className="marketing-grid">
            <article className="marketing-stat-card">
              <span>Releases</span>
              <strong>{formatNumber(data.releases.length)}</strong>
            </article>
            <article className="marketing-stat-card">
              <span>Tracked clicks</span>
              <strong>{formatNumber(data.releases.reduce((sum, release) => sum + Number(release.click_count || 0), 0))}</strong>
            </article>
          </div>
        </aside>

        <section className="public-link-content">
          <h2>Releases</h2>
          <div className="public-release-list">
            {data.releases.map((release) => (
              <Link
                className="public-release-item"
                to={release.smart_link_slug ? `/s/${release.smart_link_slug}` : `/release/${release.slug}`}
                key={release.id}
              >
                <img src={getMarketingAssetUrl(release.artwork_url)} alt="" />
                <div>
                  <strong>{release.title}</strong>
                  <p>{formatDate(release.release_date)}</p>
                </div>
                <ExternalLink size={16} />
              </Link>
            ))}
          </div>
        </section>
      </section>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
};

export default PublicArtistPage;
