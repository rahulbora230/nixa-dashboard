import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Globe2,
  Link2,
  Loader2,
  Megaphone,
  Music2,
  QrCode,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import WaveformPlayer from "../../components/audio/WaveformPlayer";
import ConfirmModal from "../../components/ui/ConfirmModal";
import StatusBadge from "../../components/releases/StatusBadge";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { getAssetUrl, releaseService } from "../../services/releaseService";
import { smartLinkService } from "../../services/smartLinkService";
import { formatReleaseDate } from "../../utils/releaseFormatters";
import "./Releases.css";

const metadataLabels = [
  ["Release Type", "release_type"],
  ["Primary Artist", "primary_artist"],
  ["Featured Artists", "featured_artists"],
  ["Label", "label_name"],
  ["Sub Label", "sub_label_name"],
  ["Genre", "genre"],
  ["Sub-genre", "sub_genre"],
  ["Language", "language"],
  ["Original Release Date", "original_release_date"],
  ["Release Date", "release_date"],
  ["Go Live Date", "go_live_date"],
  ["UPC", "upc"],
  ["Copyright Owner", "copyright_owner"],
  ["Copyright Line", "copyright_line"],
  ["Production Year", "production_year"],
  ["Catalog Number", "catalog_number"],
  ["Metadata Format", "metadata_format_version"],
  ["Template Type", "uploaded_template_type"],
  ["Territory Mode", "territory_mode"],
  ["Distribution", "distribution_type"],
  ["Publisher", "publisher"],
];

const trackLabels = [
  ["Track Title", "title"],
  ["ISRC", "isrc"],
  ["Composer", "composer"],
  ["Lyricist", "lyricist"],
  ["Producer", "producer"],
  ["Featuring", "featuring_artist"],
  ["Remixer", "remixer"],
  ["Genre", "genre"],
  ["Subgenre", "subgenre"],
  ["Mood", "mood"],
  ["Duration", "duration"],
  ["Version", "version"],
  ["Language", "language"],
  ["ISWC", "iswc"],
  ["Preview", "preview_start_time"],
];

const getTrackAudioUrl = (track) => getAssetUrl(track?.audio_url || track?.audio_file_path || "");

const toDateInputValue = (value) => {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
};

const createReleaseForm = (release) => ({
  release_type: release?.release_type || "single",
  title: release?.title || "",
  primary_artist: release?.primary_artist || "",
  featured_artists: release?.featured_artists || "",
  label_name: release?.label_name || "",
  sub_label_name: release?.sub_label_name || "",
  genre: release?.genre || "",
  sub_genre: release?.sub_genre || "",
  language: release?.language || "",
  original_release_date: toDateInputValue(release?.original_release_date),
  release_date: toDateInputValue(release?.release_date),
  go_live_date: toDateInputValue(release?.go_live_date),
  upc: release?.upc || "",
  copyright_owner: release?.copyright_owner || "",
  copyright_line: release?.copyright_line || "",
  production_year: release?.production_year || "",
  catalog_number: release?.catalog_number || "",
  territory_mode: release?.territory_mode || "worldwide",
  distribution_type: release?.distribution_type || "standard",
  promotional_release: Boolean(release?.promotional_release),
  publisher: release?.publisher || "",
  explicit: Boolean(release?.explicit),
  notes: release?.notes || "",
});

const createTrackForm = (track) => ({
  id: track?.id || null,
  title: track?.title || "",
  isrc: track?.isrc || "",
  iswc: track?.iswc || "",
  composer: track?.composer || "",
  lyricist: track?.lyricist || "",
  producer: track?.producer || "",
  featuring_artist: track?.featuring_artist || "",
  remixer: track?.remixer || "",
  genre: track?.genre || "",
  subgenre: track?.subgenre || "",
  mood: track?.mood || "",
  duration: track?.duration || "",
  version: track?.version || "",
  language: track?.language || "",
  preview_start_time: track?.preview_start_time || "",
  explicit: Boolean(track?.explicit),
  instrumental: Boolean(track?.instrumental),
  dolby_atmos: Boolean(track?.dolby_atmos),
});

const ReleaseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [release, setRelease] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [statusLogs, setStatusLogs] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [platformLinks, setPlatformLinks] = useState([]);
  const [smartLink, setSmartLink] = useState(null);
  const [marketingAnalytics, setMarketingAnalytics] = useState(null);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [ownershipHistory, setOwnershipHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [revenueHealth, setRevenueHealth] = useState(null);
  const [qcReport, setQcReport] = useState(null);
  const [artworkTheme, setArtworkTheme] = useState({
    accent: "16, 215, 255",
    glow: "217, 70, 239",
    deep: "12, 18, 39",
  });
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState("");
  const [toast, setToast] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [takedownOpen, setTakedownOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [updateRequestNotes, setUpdateRequestNotes] = useState("");
  const [takedownReason, setTakedownReason] = useState("");
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [releaseForm, setReleaseForm] = useState(() => createReleaseForm(null));
  const [trackForms, setTrackForms] = useState([]);

  const canRequestUpdate = ["artist", "label"].includes(role) && release?.status === "submitted";
  const canEditMetadata = role === "admin" || (["artist", "label"].includes(role) && ["draft", "updated"].includes(release?.status));
  const canOperateDelivery = ["admin", "accountant"].includes(role);
  const canManageMarketing = ["admin", "artist", "label"].includes(role);
  const canRequestTakedown = ["admin", "accountant", "artist", "label"].includes(role) && ["approved", "scheduled", "delivered", "live"].includes(release?.status);
  const updateRequestPending = ["artist", "label"].includes(role) && release?.status === "update_requested";
  const canSubmitDraft = ["artist", "label"].includes(role) && release?.status === "draft";
  const lockedCoreFields = role !== "admin" && ["approved", "scheduled", "delivered", "live", "updated"].includes(release?.status);
  const catalogPath = role === "label" ? "/label/catalog" : role === "artist" ? "/artist/releases" : role === "accountant" ? "/accountant/catalog" : "/catalog";
  const marketingRoot =
    role === "artist"
      ? "/artist/marketing"
      : role === "label"
        ? "/label/marketing"
        : role === "accountant"
          ? "/accountant/marketing"
          : "/marketing";
  const analyticsSummary = analytics?.summary || {};
  const marketingSummary = marketingAnalytics?.summary || {};
  const detailStyle = {
    "--artwork-accent": artworkTheme.accent,
    "--artwork-glow": artworkTheme.glow,
    "--artwork-deep": artworkTheme.deep,
  };
  const formatMetric = (value) => new Intl.NumberFormat("en-IN").format(Number(value || 0));
  const formatMoney = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  const loadRelease = useCallback(async () => {
    try {
      setLoading(true);
      const data = await releaseService.getById(id);
      setRelease(data.release);
      setTracks(data.tracks || []);
      setStatusLogs(data.statusLogs || []);
      setDeliveries(data.deliveries || []);
      setPlatformLinks(data.platformLinks || []);
      setOwnershipHistory(data.ownershipHistory || []);
      setAnalytics(data.analytics || null);
      setRevenueHealth(data.revenueHealth || null);
      setQcReport(data.qcReport || null);
      setAdminNotes(data.release?.admin_notes || "");
      setReleaseForm(createReleaseForm(data.release));
      setTrackForms((data.tracks || []).map(createTrackForm));
      setEditingMetadata(false);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not load release." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Data loading is intentionally centralized here for release id changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRelease();
  }, [loadRelease]);

  useEffect(() => {
    if (!release?.id) {
      setSmartLink(null);
      setMarketingAnalytics(null);
      return undefined;
    }

    let cancelled = false;

    const loadMarketing = async () => {
      try {
        setMarketingLoading(true);
        const listData = await smartLinkService.list({ releaseId: release.id, limit: 1 });
        const firstLink = listData.smartLinks?.[0] || null;

        if (!firstLink) {
          if (!cancelled) {
            setSmartLink(null);
            setMarketingAnalytics(null);
          }
          return;
        }

        const [detailData, analyticsData] = await Promise.all([
          smartLinkService.get(firstLink.id),
          smartLinkService.getAnalytics(firstLink.id),
        ]);

        if (!cancelled) {
          setSmartLink(detailData.smartLink);
          setMarketingAnalytics(analyticsData);
        }
      } catch {
        if (!cancelled) {
          setSmartLink(null);
          setMarketingAnalytics(null);
        }
      } finally {
        if (!cancelled) {
          setMarketingLoading(false);
        }
      }
    };

    loadMarketing();

    return () => {
      cancelled = true;
    };
  }, [release?.id]);

  useEffect(() => {
    if (!release?.artwork_url) {
      setArtworkTheme({ accent: "16, 215, 255", glow: "217, 70, 239", deep: "12, 18, 39" });
      return undefined;
    }

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = getAssetUrl(release.artwork_url);
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 42;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, size, size);
        const pixels = context.getImageData(0, 0, size, size).data;
        let red = 0;
        let green = 0;
        let blue = 0;
        let count = 0;

        for (let index = 0; index < pixels.length; index += 16) {
          const alpha = pixels[index + 3];
          if (alpha < 160) continue;
          red += pixels[index];
          green += pixels[index + 1];
          blue += pixels[index + 2];
          count += 1;
        }

        if (!cancelled && count) {
          const r = Math.round(red / count);
          const g = Math.round(green / count);
          const b = Math.round(blue / count);
          setArtworkTheme({
            accent: `${Math.max(r, 55)}, ${Math.max(g, 75)}, ${Math.max(b, 120)}`,
            glow: `${Math.min(r + 60, 255)}, ${Math.min(g + 25, 255)}, ${Math.min(b + 70, 255)}`,
            deep: `${Math.max(Math.round(r * 0.16), 8)}, ${Math.max(Math.round(g * 0.16), 10)}, ${Math.max(Math.round(b * 0.16), 20)}`,
          });
        }
      } catch {
        if (!cancelled) {
          setArtworkTheme({ accent: "16, 215, 255", glow: "217, 70, 239", deep: "12, 18, 39" });
        }
      }
    };

    return () => {
      cancelled = true;
    };
  }, [release?.artwork_url]);

  const statusActions = useMemo(
    () => [
      { status: "submitted", label: "Mark Submitted", icon: Send },
      { status: "approved", label: "Approve", icon: CheckCircle2 },
      { status: "updated", label: "Approve Update", icon: RefreshCw },
      { status: "live", label: "Mark Live", icon: Radio },
    ],
    []
  );

  const updateStatus = async (status, notes = adminNotes) => {
    try {
      setStatusLoading(status);
      const data = await releaseService.updateStatus(id, {
        status,
        admin_notes: notes,
      });
      setRelease(data.release);
      setToast({ type: "success", message: data.message || "Status updated." });
      setRejectOpen(false);
      loadRelease();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Status update failed." });
    } finally {
      setStatusLoading("");
    }
  };

  const requestUpdate = async () => {
    try {
      setStatusLoading("updated");
      const data = await releaseService.requestUpdate(id, {
        notes: updateRequestNotes,
      });
      setRelease(data.release);
      setTracks(data.tracks || []);
      setToast({ type: "success", message: data.message || "Update request sent." });
      setRequestOpen(false);
      setUpdateRequestNotes("");
      loadRelease();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Update request failed." });
    } finally {
      setStatusLoading("");
    }
  };

  const submitDraft = async () => {
    try {
      setStatusLoading("submitted");
      const data = await releaseService.submitDraft(id, { notes: "Draft submitted from catalog detail." });
      setRelease(data.release);
      setToast({ type: "success", message: data.message || "Draft submitted." });
      loadRelease();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Draft submit failed." });
    } finally {
      setStatusLoading("");
    }
  };

  const startMetadataEdit = () => {
    setReleaseForm(createReleaseForm(release));
    setTrackForms(tracks.map(createTrackForm));
    setEditingMetadata(true);
  };

  const cancelMetadataEdit = () => {
    setReleaseForm(createReleaseForm(release));
    setTrackForms(tracks.map(createTrackForm));
    setEditingMetadata(false);
  };

  const updateReleaseForm = (event) => {
    const { name, value, type, checked } = event.target;
    setReleaseForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const updateTrackForm = (index, event) => {
    const { name, value, type, checked } = event.target;
    setTrackForms((current) =>
      current.map((track, trackIndex) =>
        trackIndex === index ? { ...track, [name]: type === "checkbox" ? checked : value } : track
      )
    );
  };

  const saveMetadata = async () => {
    try {
      setMetadataLoading(true);
      const data = await releaseService.updateMetadata(id, {
        release: releaseForm,
        tracks: trackForms,
      });
      setRelease(data.release);
      setTracks(data.tracks || []);
      setReleaseForm(createReleaseForm(data.release));
      setTrackForms((data.tracks || []).map(createTrackForm));
      setEditingMetadata(false);
      setToast({ type: "success", message: data.message || "Metadata updated." });
      loadRelease();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Metadata update failed." });
    } finally {
      setMetadataLoading(false);
    }
  };

  const copyPlatformUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setToast({ type: "success", message: "Link copied." });
    } catch {
      setToast({ type: "error", message: "Could not copy link." });
    }
  };

  const deleteDelivery = async (deliveryId) => {
    try {
      await releaseService.deleteDelivery(id, deliveryId);
      setToast({ type: "success", message: "Platform link removed." });
      loadRelease();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not remove platform link." });
    }
  };

  const runQc = async () => {
    try {
      setStatusLoading("qc");
      const data = await releaseService.runQc(id);
      setToast({ type: "success", message: data.message || "QC run complete." });
      loadRelease();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "QC run failed." });
    } finally {
      setStatusLoading("");
    }
  };

  const queueDelivery = async () => {
    try {
      setStatusLoading("delivery_queue");
      const data = await releaseService.queueDelivery(id, { force: true });
      setToast({ type: "success", message: data.message || "Delivery queued." });
      loadRelease();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Delivery queue failed." });
    } finally {
      setStatusLoading("");
    }
  };

  const retryDelivery = async (queueId) => {
    try {
      setStatusLoading(`retry-${queueId}`);
      const data = await releaseService.retryDelivery(id, queueId);
      setToast({ type: "success", message: data.message || "Delivery retry queued." });
      loadRelease();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Delivery retry failed." });
    } finally {
      setStatusLoading("");
    }
  };

  const requestTakedown = async () => {
    try {
      setStatusLoading("takedown");
      const data = await releaseService.requestTakedown(id, { reason: takedownReason });
      setToast({ type: "success", message: data.message || "Takedown requested." });
      setTakedownReason("");
      setTakedownOpen(false);
      loadRelease();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Takedown request failed." });
    } finally {
      setStatusLoading("");
    }
  };

  const handleDelete = async () => {
    try {
      await releaseService.remove(id);
      setToast({ type: "success", message: "Release deleted." });
      navigate(role === "label" ? "/label/catalog" : role === "artist" ? "/artist/releases" : "/catalog");
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Delete failed." });
    }
  };

  if (loading) {
    return (
      <section className="catalog-skeleton">
        <div className="skeleton detail-skeleton-main" />
        <div className="skeleton catalog-skeleton-row" />
        <div className="skeleton catalog-skeleton-row" />
      </section>
    );
  }

  if (!release) {
    return (
      <section className="empty-state">
        <span>Missing Release</span>
        <h2>Release not found</h2>
        <p>The release may have been deleted or you may not have access to it.</p>
      </section>
    );
  }

  return (
    <div className="page-stack release-workspace release-detail-themed" style={detailStyle}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmModal
        open={rejectOpen}
        title="Reject this release?"
        message="Add a clear reason so the submitter can correct the release package."
        confirmLabel="Reject Release"
        onCancel={() => setRejectOpen(false)}
        onConfirm={() => updateStatus("rejected", adminNotes)}
      >
        <textarea
          className="modal-textarea"
          value={adminNotes}
          onChange={(event) => setAdminNotes(event.target.value)}
          placeholder="Missing credits, artwork issue, metadata mismatch..."
          rows={4}
        />
      </ConfirmModal>
      <ConfirmModal
        open={requestOpen}
        title="Request an update?"
        message="This sends the release back to admin as an update request. Add what needs to change."
        confirmLabel="Request Update"
        onCancel={() => setRequestOpen(false)}
        onConfirm={requestUpdate}
      >
        <textarea
          className="modal-textarea"
          value={updateRequestNotes}
          onChange={(event) => setUpdateRequestNotes(event.target.value)}
          placeholder="Artwork correction, metadata update, audio replacement..."
          rows={4}
        />
      </ConfirmModal>
      <ConfirmModal
        open={deleteOpen}
        title="Delete release?"
        message={`This permanently removes ${release.title} from the catalog.`}
        confirmLabel="Delete Release"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
      <ConfirmModal
        open={takedownOpen}
        title="Request takedown?"
        message="Create an operations request to remove this release from DSPs."
        confirmLabel="Request Takedown"
        onCancel={() => setTakedownOpen(false)}
        onConfirm={requestTakedown}
      >
        <textarea
          className="modal-textarea"
          value={takedownReason}
          onChange={(event) => setTakedownReason(event.target.value)}
          placeholder="Rights expiry, incorrect delivery, artist request..."
          rows={4}
        />
      </ConfirmModal>

      <section className="details-topline">
        <button className="secondary-button" type="button" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <StatusBadge status={release.status} />
      </section>

      <section className="release-details-layout">
        <aside className="asset-detail-panel">
          <div className="artwork-blur-backdrop" aria-hidden="true" />
          {release.artwork_url ? (
            <img src={getAssetUrl(release.artwork_url)} alt={release.title} />
          ) : (
            <div className="artwork-placeholder large">
              <Music2 size={36} />
            </div>
          )}
          <div className="download-stack">
            {release.artwork_download_url && (
              <button className="secondary-button" type="button" onClick={() => releaseService.download(release.artwork_download_url, `${release.title}-artwork`)}>
                <Download size={16} />
                Download Artwork
              </button>
            )}
            {release.audio_download_url && (
              <button className="secondary-button" type="button" onClick={() => releaseService.download(release.audio_download_url, `${release.title}-audio`)}>
                <Download size={16} />
                Download Audio
              </button>
            )}
          </div>
        </aside>

        <main className="detail-main-panel">
          <div className="detail-heading">
            <div>
              <p className="eyebrow">Release Detail</p>
              <h2>{release.title}</h2>
              <span>
                Created {formatReleaseDate(release.created_at)} / Updated {formatReleaseDate(release.updated_at)}
              </span>
            </div>
            <div className="detail-heading-actions">
              {canRequestUpdate && (
                <button className="secondary-button" type="button" disabled={Boolean(statusLoading)} onClick={() => setRequestOpen(true)}>
                  {statusLoading === "updated" ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                  Request Update
                </button>
              )}
              {canSubmitDraft && (
                <button className="primary-button" type="button" disabled={Boolean(statusLoading)} onClick={submitDraft}>
                  {statusLoading === "submitted" ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                  Submit Draft
                </button>
              )}
              {updateRequestPending && <span className="soft-pill">Update request pending</span>}
              {canEditMetadata && !editingMetadata && (
                <button className="secondary-button" type="button" onClick={startMetadataEdit}>
                  <Edit3 size={16} />
                  Edit Metadata
                </button>
              )}
              {canOperateDelivery && (
                <button className="secondary-button" type="button" disabled={Boolean(statusLoading)} onClick={runQc}>
                  {statusLoading === "qc" ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
                  Run QC
                </button>
              )}
              {canOperateDelivery && (
                <button className="secondary-button" type="button" disabled={Boolean(statusLoading)} onClick={queueDelivery}>
                  {statusLoading === "delivery_queue" ? <Loader2 className="spin" size={16} /> : <Radio size={16} />}
                  Queue DSP
                </button>
              )}
              {canRequestTakedown && (
                <button className="danger-button" type="button" disabled={Boolean(statusLoading)} onClick={() => setTakedownOpen(true)}>
                  {statusLoading === "takedown" ? <Loader2 className="spin" size={16} /> : <XCircle size={16} />}
                  Takedown
                </button>
              )}
              {role === "admin" && (
                <button className="danger-icon-button" type="button" onClick={() => setDeleteOpen(true)} aria-label="Delete release">
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </div>

          <section className="detail-summary-grid">
            <div>
              <span>Status</span>
              <strong>{release.status || "draft"}</strong>
            </div>
            <div>
              <span>Tracks</span>
              <strong>{tracks.length}</strong>
            </div>
            <div>
              <span>Release Date</span>
              <strong>{formatReleaseDate(release.release_date)}</strong>
            </div>
            <div>
              <span>UPC</span>
              <strong>{release.upc || "Not assigned"}</strong>
            </div>
            <div>
              <span>Metadata</span>
              <strong>{release.metadata_completion_percentage || qcReport?.completion || 0}%</strong>
            </div>
            <div>
              <span>Streams</span>
              <strong>{formatMetric(analyticsSummary.streams)}</strong>
            </div>
            <div>
              <span>Revenue</span>
              <strong>{formatMoney(revenueHealth?.gross_revenue)}</strong>
            </div>
            <div>
              <span>Delivery</span>
              <strong>{release.delivery_status || "pending"}</strong>
            </div>
          </section>

          {editingMetadata && (
            <section className="detail-card metadata-editor-card">
              <div className="form-section-heading">
                <Edit3 size={18} />
                <div>
                  <h3>Edit Metadata</h3>
                  <p>
                    {role === "admin"
                      ? "Admin edits are saved without changing the release status."
                      : "After saving, the updated metadata is submitted back to admin for review."}
                  </p>
                </div>
              </div>

              <div className="form-grid two-columns">
                <label>
                  <span>Release Type</span>
                  <select name="release_type" value={releaseForm.release_type} onChange={updateReleaseForm}>
                    <option value="single">Single</option>
                    <option value="ep">EP</option>
                    <option value="album">Album</option>
                  </select>
                </label>
                <label>
                  <span>Release Title</span>
                  <input name="title" value={releaseForm.title} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Primary Artist</span>
                  <input name="primary_artist" value={releaseForm.primary_artist} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Featured Artists</span>
                  <input name="featured_artists" value={releaseForm.featured_artists} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Label</span>
                  <input name="label_name" value={releaseForm.label_name} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Sub Label</span>
                  <input name="sub_label_name" value={releaseForm.sub_label_name} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Genre</span>
                  <input name="genre" value={releaseForm.genre} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Sub-genre</span>
                  <input name="sub_genre" value={releaseForm.sub_genre} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Language</span>
                  <input name="language" value={releaseForm.language} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Release Date</span>
                  <input type="date" name="release_date" value={releaseForm.release_date} onChange={updateReleaseForm} disabled={lockedCoreFields} />
                </label>
                <label>
                  <span>Original Release Date</span>
                  <input type="date" name="original_release_date" value={releaseForm.original_release_date} onChange={updateReleaseForm} disabled={lockedCoreFields} />
                </label>
                <label>
                  <span>Go Live Date</span>
                  <input type="date" name="go_live_date" value={releaseForm.go_live_date} onChange={updateReleaseForm} disabled={lockedCoreFields} />
                </label>
                <label>
                  <span>UPC</span>
                  <input name="upc" value={releaseForm.upc} onChange={updateReleaseForm} disabled={lockedCoreFields} />
                </label>
                <label>
                  <span>Copyright Owner</span>
                  <input name="copyright_owner" value={releaseForm.copyright_owner} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Copyright Line</span>
                  <input name="copyright_line" value={releaseForm.copyright_line} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Production Year</span>
                  <input name="production_year" value={releaseForm.production_year} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Catalog Number</span>
                  <input name="catalog_number" value={releaseForm.catalog_number} onChange={updateReleaseForm} />
                </label>
                <label>
                  <span>Territory Mode</span>
                  <select name="territory_mode" value={releaseForm.territory_mode} onChange={updateReleaseForm}>
                    <option value="worldwide">Worldwide</option>
                    <option value="include">Include only</option>
                    <option value="exclude">Exclude selected</option>
                  </select>
                </label>
                <label>
                  <span>Distribution</span>
                  <select name="distribution_type" value={releaseForm.distribution_type} onChange={updateReleaseForm}>
                    <option value="standard">Standard</option>
                    <option value="priority">Priority</option>
                    <option value="update">Metadata update</option>
                    <option value="takedown">Takedown</option>
                  </select>
                </label>
                <label>
                  <span>Publisher</span>
                  <input name="publisher" value={releaseForm.publisher} onChange={updateReleaseForm} />
                </label>
                <label className="toggle-row">
                  <input type="checkbox" name="explicit" checked={releaseForm.explicit} onChange={updateReleaseForm} />
                  <span>Explicit release</span>
                </label>
                <label className="toggle-row">
                  <input type="checkbox" name="promotional_release" checked={releaseForm.promotional_release} onChange={updateReleaseForm} />
                  <span>Promotional release</span>
                </label>
              </div>

              <label>
                <span>Release Notes</span>
                <textarea name="notes" value={releaseForm.notes} onChange={updateReleaseForm} rows={4} />
              </label>

              <div className="metadata-track-editor-list">
                {trackForms.map((track, index) => (
                  <section className="metadata-track-editor" key={track.id || index}>
                    <div className="detail-track-heading">
                      <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{track.title || "Untitled track"}</strong>
                        <span>{track.isrc || "ISRC pending"}</span>
                      </div>
                    </div>
                    <div className="form-grid two-columns">
                      <label>
                        <span>Track Title</span>
                        <input name="title" value={track.title} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>ISRC</span>
                        <input name="isrc" value={track.isrc} onChange={(event) => updateTrackForm(index, event)} disabled={lockedCoreFields} />
                      </label>
                      <label>
                        <span>ISWC</span>
                        <input name="iswc" value={track.iswc} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Composer</span>
                        <input name="composer" value={track.composer} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Lyricist</span>
                        <input name="lyricist" value={track.lyricist} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Producer</span>
                        <input name="producer" value={track.producer} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Featuring</span>
                        <input name="featuring_artist" value={track.featuring_artist} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Remixer</span>
                        <input name="remixer" value={track.remixer} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Genre</span>
                        <input name="genre" value={track.genre} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Subgenre</span>
                        <input name="subgenre" value={track.subgenre} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Mood</span>
                        <input name="mood" value={track.mood} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Duration</span>
                        <input name="duration" value={track.duration} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Version</span>
                        <input name="version" value={track.version} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Language</span>
                        <input name="language" value={track.language} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label>
                        <span>Preview Start</span>
                        <input name="preview_start_time" value={track.preview_start_time} onChange={(event) => updateTrackForm(index, event)} />
                      </label>
                      <label className="toggle-row">
                        <input type="checkbox" name="explicit" checked={track.explicit} onChange={(event) => updateTrackForm(index, event)} />
                        <span>Explicit track</span>
                      </label>
                      <label className="toggle-row">
                        <input type="checkbox" name="instrumental" checked={track.instrumental} onChange={(event) => updateTrackForm(index, event)} />
                        <span>Instrumental</span>
                      </label>
                      <label className="toggle-row">
                        <input type="checkbox" name="dolby_atmos" checked={track.dolby_atmos} onChange={(event) => updateTrackForm(index, event)} />
                        <span>Dolby Atmos</span>
                      </label>
                    </div>
                  </section>
                ))}
              </div>

              <div className="approval-actions">
                <button className="secondary-button" type="button" disabled={metadataLoading} onClick={cancelMetadataEdit}>
                  Cancel
                </button>
                <button className="primary-button" type="button" disabled={metadataLoading} onClick={saveMetadata}>
                  {metadataLoading ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
                  Save Metadata
                </button>
              </div>
            </section>
          )}

          <section className="detail-card release-health-card">
            <div className="form-section-heading">
              <Sparkles size={18} />
              <div>
                <h3>Release Health</h3>
                <p>QC, delivery, analytics and payout signals for this catalog item.</p>
              </div>
            </div>
            <div className="health-grid">
              <div>
                <span>QC Score</span>
                <strong>{qcReport?.score ?? release.qc_score ?? 0}</strong>
                <small>{qcReport?.status || release.qc_status || "pending"}</small>
              </div>
              <div>
                <span>Release Health</span>
                <strong>{qcReport?.health ?? release.release_health_score ?? 0}</strong>
                <small>{release.metadata_locked ? "metadata locked" : "metadata editable"}</small>
              </div>
              <div>
                <span>Total Streams</span>
                <strong>{formatMetric(analyticsSummary.streams)}</strong>
                <small>{formatMetric(analyticsSummary.listeners)} listeners</small>
              </div>
              <div>
                <span>Net Revenue</span>
                <strong>{formatMoney(revenueHealth?.net_revenue)}</strong>
                <small>{formatMoney(revenueHealth?.pending_amount)} pending</small>
              </div>
              <div>
                <span>Payable</span>
                <strong>{formatMoney(revenueHealth?.payable_amount)}</strong>
                <small>{formatMoney(revenueHealth?.paid_amount)} paid</small>
              </div>
            </div>
            {((qcReport?.errors || release.qc_errors || []).length > 0 || (qcReport?.warnings || release.qc_warnings || []).length > 0) && (
              <div className="qc-message-grid">
                {(qcReport?.errors || release.qc_errors || []).map((message) => (
                  <span className="qc-error" key={`error-${message}`}>{message}</span>
                ))}
                {(qcReport?.warnings || release.qc_warnings || []).map((message) => (
                  <span className="qc-warning" key={`warning-${message}`}>{message}</span>
                ))}
              </div>
            )}
          </section>

          <section className="detail-card analytics-card">
            <div className="form-section-heading">
              <BarChart3 size={18} />
              <div>
                <h3>Daily Performance</h3>
                <p>Streams, listeners, estimated revenue and territory signals from daily play reports.</p>
              </div>
            </div>
            <div className="mini-analytics-grid">
              {(analytics?.platformBreakdown || []).slice(0, 5).map((item) => (
                <div key={item.platform || item.name}>
                  <span>{item.platform || item.name}</span>
                  <strong>{formatMetric(item.streams)}</strong>
                </div>
              ))}
              {(analytics?.countryBreakdown || analytics?.topCountries || []).slice(0, 5).map((item) => (
                <div key={item.country}>
                  <span>{item.country}</span>
                  <strong>{formatMetric(item.streams)}</strong>
                </div>
              ))}
              {analyticsSummary.estimated_revenue ? (
                <div>
                  <span>Estimated Revenue</span>
                  <strong>{formatMoney(analyticsSummary.estimated_revenue)}</strong>
                </div>
              ) : null}
              {!(analytics?.platformBreakdown || []).length && !(analytics?.countryBreakdown || analytics?.topCountries || []).length && (
                <p className="soft-copy">No daily play report has been imported for this release yet.</p>
              )}
            </div>
          </section>

          <section className="detail-card marketing-card">
            <div className="form-section-heading">
              <Megaphone size={18} />
              <div>
                <h3>Marketing Tools</h3>
                <p>Smart link, QR code, promo kit and click intelligence for this release.</p>
              </div>
            </div>
            <div className="marketing-detail-actions">
              {smartLink ? (
                <>
                  <Link className="secondary-button" to={`${marketingRoot}/smart-links/${smartLink.id}`}>
                    <Link2 size={16} />
                    View Smart Link
                  </Link>
                  <a className="secondary-button" href={smartLink.public_url} target="_blank" rel="noreferrer">
                    <Globe2 size={16} />
                    Public Page
                  </a>
                  <button className="secondary-button" type="button" onClick={() => copyPlatformUrl(smartLink.public_url)}>
                    <QrCode size={16} />
                    Copy QR Link
                  </button>
                </>
              ) : canManageMarketing ? (
                <Link className="primary-button" to={`${marketingRoot}/smart-links/new?releaseId=${release.id}`}>
                  <Link2 size={16} />
                  Create Smart Link
                </Link>
              ) : (
                <span className="soft-copy">No smart link has been created for this release yet.</span>
              )}
              <Link className="secondary-button" to={`${marketingRoot}/promo-kit/${release.id}`}>
                <Sparkles size={16} />
                Generate Promo Kit
              </Link>
            </div>
            <div className="marketing-widget-grid">
              <div>
                <span>Total Clicks</span>
                <strong>{marketingLoading ? "..." : formatMetric(marketingSummary.total_clicks)}</strong>
              </div>
              <div>
                <span>Unique Visitors</span>
                <strong>{marketingLoading ? "..." : formatMetric(marketingSummary.unique_visitors)}</strong>
              </div>
              <div>
                <span>DSP Click Rate</span>
                <strong>{marketingLoading ? "..." : `${marketingSummary.conversion_rate || 0}%`}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{smartLink?.status || "not linked"}</strong>
              </div>
            </div>
          </section>

          <section className="detail-card">
            <div className="form-section-heading">
              <Globe2 size={18} />
              <div>
                <h3>DSP Delivery Matrix</h3>
                <p>Platform IDs, links and delivery state by release or track.</p>
              </div>
            </div>
            {(deliveries.length || platformLinks.length) ? (
              <div className="responsive-table dsp-table">
                <table>
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Track</th>
                      <th>Status</th>
                      <th>Platform ID</th>
                      <th>URL</th>
                      <th>Updated</th>
                      {canOperateDelivery && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(deliveries.length ? deliveries : platformLinks).map((item) => (
                      <tr key={item.id || `${item.platform}-${item.track_id}`}>
                        <td>{item.platform}</td>
                        <td>{item.track_title || item.isrc || "Release level"}</td>
                        <td>
                          <span className={`delivery-pill ${item.delivery_status || "live"}`}>
                            {item.delivery_status || "linked"}
                          </span>
                        </td>
                        <td>{item.platform_track_id || "Not provided"}</td>
                        <td>
                          {item.platform_url ? (
                            <a href={item.platform_url} target="_blank" rel="noreferrer">
                              <Link2 size={14} />
                              Open
                            </a>
                          ) : (
                            "Not linked"
                          )}
                        </td>
                        <td>{formatReleaseDate(item.last_updated || item.updated_at || item.delivery_date)}</td>
                        {canOperateDelivery && (
                          <td>
                            <div className="table-actions">
                              {item.platform_url && (
                                <button type="button" onClick={() => copyPlatformUrl(item.platform_url)} aria-label="Copy platform link">
                                  <Copy size={14} />
                                </button>
                              )}
                              {item.queue_id && ["failed", "rejected", "retry_failed", "queued", "pending"].includes(item.queue_status || item.delivery_status) && (
                                <button type="button" onClick={() => retryDelivery(item.queue_id)} aria-label="Retry delivery">
                                  {statusLoading === `retry-${item.queue_id}` ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
                                </button>
                              )}
                              {role === "admin" && item.id && item.delivery_status !== undefined && (
                                <button type="button" onClick={() => deleteDelivery(item.id)} aria-label="Delete platform link">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="soft-copy">No DSP deliveries or platform links recorded yet.</p>
            )}
          </section>

          <section className="detail-card">
            <div className="form-section-heading">
              <ShieldCheck size={18} />
              <div>
                <h3>Metadata</h3>
                <p>Release-level fields submitted for distribution.</p>
              </div>
            </div>
            <div className="metadata-grid">
              {metadataLabels.map(([label, key]) => (
                <div key={key}>
                  <span>{label}</span>
                  <strong>{key.includes("date") ? formatReleaseDate(release[key]) : release[key] || "Not provided"}</strong>
                </div>
              ))}
              <div>
                <span>Explicit</span>
                <strong>{release.explicit ? "Yes" : "No"}</strong>
              </div>
            </div>
          </section>

          <section className="detail-card">
            <div className="form-section-heading">
              <Music2 size={18} />
              <div>
                <h3>Album Tracks</h3>
                <p>Every song attached to this release, with credits and waveform audio.</p>
              </div>
            </div>
            {tracks.length ? (
              <div className="detail-track-list">
                {tracks.map((track, index) => (
                  <article className="detail-track-card" key={track.id || `${release.id}-${index}`}>
                    <div className="detail-track-heading">
                      <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{track.title || "Untitled track"}</strong>
                        <span>{track.isrc || "ISRC pending"}</span>
                      </div>
                    </div>
                    <div className="metadata-grid detail-track-metadata">
                      <div>
                        <span>Completion</span>
                        <strong>{track.metadata_completion_percentage || 0}%</strong>
                      </div>
                      <div>
                        <span>QC</span>
                        <strong>{track.qc_status || "pending"}</strong>
                      </div>
                      {trackLabels.slice(2).map(([label, key]) => (
                        <div key={key}>
                          <span>{label}</span>
                          <strong>{track[key] || "Not provided"}</strong>
                        </div>
                      ))}
                      <div>
                        <span>Explicit</span>
                        <strong>{track.explicit ? "Yes" : "No"}</strong>
                      </div>
                    </div>
                    <WaveformPlayer src={getTrackAudioUrl(track)} title={`${track.title || `Track ${index + 1}`} waveform`} />
                  </article>
                ))}
              </div>
            ) : (
              <div className="catalog-track-empty">
                <Music2 size={17} />
                <span>No tracks attached yet.</span>
              </div>
            )}
          </section>

          {(release.notes || (["admin", "accountant"].includes(role) && (release.admin_notes || release.internal_notes))) && (
            <section className="detail-card notes-card">
              {release.notes && (
                <div>
                  <span>Release Notes</span>
                  <p>{release.notes}</p>
                </div>
              )}
              {["admin", "accountant"].includes(role) && release.internal_notes && (
                <div>
                  <span>Internal QC Notes</span>
                  <p>{release.internal_notes}</p>
                </div>
              )}
              {["admin", "accountant"].includes(role) && release.admin_notes && (
                <div>
                  <span>Admin Notes</span>
                  <p>{release.admin_notes}</p>
                </div>
              )}
            </section>
          )}

          {role === "admin" && (
            <section className="detail-card admin-approval-card">
              <div className="form-section-heading">
                <ShieldCheck size={18} />
                <div>
                  <h3>Admin Approval</h3>
                  <p>Change distribution status and add internal notes.</p>
                </div>
              </div>
              <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} placeholder="Internal notes or approval comments" rows={4} />
              <div className="approval-actions">
                {statusActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <button
                      className="secondary-button"
                      disabled={Boolean(statusLoading)}
                      key={action.status}
                      type="button"
                      onClick={() => updateStatus(action.status)}
                    >
                      {statusLoading === action.status ? <Loader2 className="spin" size={16} /> : <Icon size={16} />}
                      {action.label}
                    </button>
                  );
                })}
                <button className="danger-button" disabled={Boolean(statusLoading)} type="button" onClick={() => setRejectOpen(true)}>
                  {statusLoading === "rejected" ? <Loader2 className="spin" size={16} /> : <XCircle size={16} />}
                  Reject
                </button>
              </div>
            </section>
          )}

          <section className="detail-card">
            <div className="form-section-heading">
              <Radio size={18} />
              <div>
                <h3>Status History</h3>
                <p>Approval and catalog lifecycle changes.</p>
              </div>
            </div>
            {statusLogs.length ? (
              <div className="status-timeline">
                {statusLogs.map((log, index) => (
                  <div key={`${log.to_status}-${log.created_at}-${index}`}>
                    <span />
                    <div>
                      <strong>{log.from_status || "created"} to {log.to_status}</strong>
                      <p>{log.notes || "No notes"} / {formatReleaseDate(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="soft-copy">No status history yet.</p>
            )}
          </section>

          {["admin", "accountant"].includes(role) && (
            <section className="detail-card">
              <div className="form-section-heading">
                <WalletCards size={18} />
                <div>
                  <h3>Ownership & Payout Context</h3>
                  <p>Current owner and transfer history used by finance, payouts and reporting.</p>
                </div>
              </div>
              <div className="metadata-grid">
                <div>
                  <span>Current Owner</span>
                  <strong>{release.current_owner || release.created_by || "Not assigned"}</strong>
                </div>
                <div>
                  <span>Previous Owner</span>
                  <strong>{release.previous_owner || "None"}</strong>
                </div>
                <div>
                  <span>Transferable</span>
                  <strong>{release.ownership_transferable === false ? "No" : "Yes"}</strong>
                </div>
              </div>
              {ownershipHistory.length ? (
                <div className="status-timeline compact">
                  {ownershipHistory.map((item) => (
                    <div key={item.id || item.created_at}>
                      <span />
                      <div>
                        <strong>{item.old_owner || "Unassigned"} to {item.new_owner}</strong>
                        <p>{item.reason || "No reason"} / {formatReleaseDate(item.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="soft-copy">No ownership transfer history.</p>
              )}
            </section>
          )}

          <Link className="secondary-button detail-catalog-link" to={catalogPath}>
            Open Catalog
          </Link>
        </main>
      </section>
    </div>
  );
};

export default ReleaseDetails;
