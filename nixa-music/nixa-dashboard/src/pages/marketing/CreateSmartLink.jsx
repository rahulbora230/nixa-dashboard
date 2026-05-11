import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { getMarketingAssetUrl, smartLinkService } from "../../services/smartLinkService";
import { releaseService } from "../../services/releaseService";
import { formatDate } from "../../utils/formatters";
import "./Marketing.css";

const defaultPlatforms = [
  "Spotify",
  "Apple Music",
  "YouTube",
  "JioSaavn",
  "Wynk",
  "Amazon Music",
  "Gaana",
  "Boomplay",
];

const emptyPlatform = (index = 0) => ({
  platform: "",
  url: "",
  button_text: "",
  display_order: index + 1,
  is_active: true,
});

const slugify = (value = "") =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

const CreateSmartLink = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const releaseIdFromQuery = searchParams.get("releaseId");
  const trackIdFromQuery = searchParams.get("trackId");
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [releaseSearch, setReleaseSearch] = useState("");
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    release_id: releaseIdFromQuery || "",
    track_id: trackIdFromQuery || "",
    title: "",
    slug: "",
    description: "",
    status: "active",
  });
  const [platforms, setPlatforms] = useState(defaultPlatforms.map((platform, index) => ({ ...emptyPlatform(index), platform })));

  useEffect(() => {
    const loadReleases = async () => {
      try {
        setLoadingReleases(true);
        const data = await releaseService.list({ search: releaseSearch, limit: 20 });
        setReleases(data.releases || data.data || []);
      } catch (error) {
        setToast({ type: "error", message: error.response?.data?.message || "Could not load releases." });
      } finally {
        setLoadingReleases(false);
      }
    };

    const timer = window.setTimeout(loadReleases, 250);
    return () => window.clearTimeout(timer);
  }, [releaseSearch]);

  useEffect(() => {
    if (!releaseIdFromQuery) {
      return;
    }

    const loadRelease = async () => {
      try {
        const data = await releaseService.getById(releaseIdFromQuery);
        setSelectedRelease(data.release);
        setTracks(data.tracks || []);
        setForm((current) => ({
          ...current,
          release_id: data.release?.id || releaseIdFromQuery,
          title: current.title || data.release?.release_title || data.release?.title || "",
          slug: current.slug || slugify(`${data.release?.primary_artist || ""} ${data.release?.release_title || data.release?.title || ""}`),
        }));
      } catch (error) {
        setToast({ type: "error", message: error.response?.data?.message || "Could not load selected release." });
      }
    };

    loadRelease();
  }, [releaseIdFromQuery]);

  const selectRelease = async (release) => {
    try {
      const data = await releaseService.getById(release.id);
      setSelectedRelease(data.release);
      setTracks(data.tracks || []);
      setForm((current) => ({
        ...current,
        release_id: release.id,
        track_id: "",
        title: data.release?.release_title || data.release?.title || release.title || "",
        slug: slugify(`${data.release?.primary_artist || release.primary_artist || ""} ${data.release?.release_title || data.release?.title || release.title || ""}`),
      }));
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not select release." });
    }
  };

  const selectedTrack = useMemo(
    () => tracks.find((track) => String(track.id) === String(form.track_id)),
    [form.track_id, tracks]
  );

  useEffect(() => {
    if (!selectedTrack) {
      return;
    }

    setForm((current) => ({
      ...current,
      title: selectedTrack.title || selectedTrack.song_name || current.title,
      slug: slugify(`${selectedRelease?.primary_artist || ""} ${selectedTrack.title || selectedTrack.song_name || ""}`),
    }));
  }, [selectedRelease?.primary_artist, selectedTrack]);

  const updatePlatform = (index, key, value) => {
    setPlatforms((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const addPlatform = () => {
    setPlatforms((current) => [...current, emptyPlatform(current.length)]);
  };

  const removePlatform = (index) => {
    setPlatforms((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const submit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const payload = {
        ...form,
        platforms: platforms.filter((platform) => platform.platform && platform.url),
      };
      const data = await smartLinkService.create(payload);
      setToast({ type: "success", message: "Smart link created." });
      navigate(`/marketing/smart-links/${data.smartLink.id}`);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not create smart link." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div>
          <span className="marketing-eyebrow">Smart link builder</span>
          <h1>Create Smart Link</h1>
          <p>Pick a catalog release, customize DSP buttons, and publish a mobile-first public landing page.</p>
        </div>
        <Link className="marketing-button" to="/marketing/smart-links">
          <ArrowLeft size={17} /> Back to links
        </Link>
      </section>

      <form className="marketing-form-grid" onSubmit={submit}>
        <section className="marketing-panel marketing-form-section">
          <div className="marketing-panel-header">
            <div>
              <h2>Release and page details</h2>
              <p className="marketing-muted">DSP links from delivery/imports will be used automatically when custom fields are empty.</p>
            </div>
          </div>

          <div className="marketing-field-grid">
            <label>
              <span className="marketing-label">Title</span>
              <input
                className="marketing-input"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Release or track title"
                required
              />
            </label>
            <label>
              <span className="marketing-label">Slug</span>
              <input
                className="marketing-input"
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
                placeholder="artist-song-name"
              />
            </label>
          </div>

          <label>
            <span className="marketing-label">Description</span>
            <textarea
              className="marketing-textarea"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Short landing-page copy"
            />
          </label>

          <div className="marketing-field-grid">
            <label>
              <span className="marketing-label">Track</span>
              <select
                className="marketing-select"
                value={form.track_id}
                onChange={(event) => setForm((current) => ({ ...current, track_id: event.target.value }))}
                disabled={!tracks.length}
              >
                <option value="">Release-level link</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.title || track.song_name || track.isrc}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="marketing-label">Status</span>
              <select
                className="marketing-select"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
                <option value="pre_save">Pre-save ready</option>
              </select>
            </label>
          </div>

          <div className="marketing-panel-header">
            <div>
              <h2>DSP buttons</h2>
              <p className="marketing-muted">Leave blank to let Nixa pull live DSP links already imported for this release.</p>
            </div>
            <button type="button" className="marketing-button" onClick={addPlatform}>
              <Plus size={16} /> Add
            </button>
          </div>

          <div className="platform-list">
            {platforms.map((platform, index) => (
              <div className="platform-editor-row" key={`${platform.platform}-${index}`}>
                <input
                  className="marketing-input"
                  value={platform.platform}
                  onChange={(event) => updatePlatform(index, "platform", event.target.value)}
                  placeholder="Platform"
                />
                <input
                  className="marketing-input"
                  value={platform.url}
                  onChange={(event) => updatePlatform(index, "url", event.target.value)}
                  placeholder="https://..."
                />
                <input
                  className="marketing-input"
                  value={platform.button_text}
                  onChange={(event) => updatePlatform(index, "button_text", event.target.value)}
                  placeholder="Button text"
                />
                <button type="button" className="marketing-button danger" onClick={() => removePlatform(index)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button type="submit" className="marketing-button primary" disabled={saving || !form.release_id}>
            {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />} Publish smart link
          </button>
        </section>

        <aside className="marketing-panel marketing-form-section">
          <div className="marketing-panel-header">
            <div>
              <h2>Choose release</h2>
              <p className="marketing-muted">Search by title, artist, UPC or catalog metadata.</p>
            </div>
          </div>

          <label className="marketing-search">
            <Search size={16} />
            <input
              value={releaseSearch}
              onChange={(event) => setReleaseSearch(event.target.value)}
              placeholder="Search catalog"
            />
          </label>

          {selectedRelease ? (
            <div className="release-picker-card selected">
              <img className="marketing-artwork" src={getMarketingAssetUrl(selectedRelease.artwork_url)} alt="" />
              <div>
                <strong>{selectedRelease.release_title || selectedRelease.title}</strong>
                <span>{selectedRelease.primary_artist}</span>
                <span>{formatDate(selectedRelease.release_date)}</span>
              </div>
            </div>
          ) : null}

          {loadingReleases ? (
            <div className="marketing-skeleton" />
          ) : (
            <div className="release-picker-grid">
              {releases.map((release) => (
                <button
                  type="button"
                  className={`release-picker-card ${form.release_id === release.id ? "selected" : ""}`}
                  key={release.id}
                  onClick={() => selectRelease(release)}
                >
                  <img className="marketing-artwork" src={getMarketingAssetUrl(release.artwork_url)} alt="" />
                  <div>
                    <strong>{release.release_title || release.title}</strong>
                    <span>{release.primary_artist}</span>
                    <span>{formatDate(release.release_date)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>
      </form>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default CreateSmartLink;
