import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  Disc3,
  Eye,
  FileSpreadsheet,
  Grid3X3,
  List,
  Loader2,
  Music2,
  Plus,
  Search,
  Square,
  Trash2,
  UploadCloud,
  Wand2,
} from "lucide-react";
import WaveformPlayer from "../../components/audio/WaveformPlayer";
import ConfirmModal from "../../components/ui/ConfirmModal";
import StatusBadge from "../../components/releases/StatusBadge";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { getAssetUrl, releaseService } from "../../services/releaseService";
import { formatReleaseDate } from "../../utils/releaseFormatters";
import "./Releases.css";

const statusOptions = [
  "all",
  "draft",
  "submitted",
  "under_review",
  "metadata_qc",
  "artwork_qc",
  "audio_qc",
  "approved",
  "scheduled",
  "delivered",
  "live",
  "update_requested",
  "updated",
  "rejected",
  "takedown_requested",
  "takedown_complete",
  "archived",
];
const typeOptions = ["all", "single", "ep", "album"];

const getArtworkUrl = (release) => getAssetUrl(release.artwork_url || release.artwork_file_path || "");
const getTrackAudioUrl = (track) => getAssetUrl(track.audio_url || track.audio_file_path || "");
const unwrapImportPreview = (payload) => payload?.data || payload || {};
const getImportId = (preview) => preview?.import?.id || preview?.import_id || preview?.id || preview?.data?.import?.id || "";

const TrackList = ({ release }) => {
  const tracks = Array.isArray(release.tracks) ? release.tracks : [];

  if (!tracks.length) {
    return (
      <div className="catalog-track-empty">
        <Music2 size={17} />
        <span>No track metadata attached yet.</span>
      </div>
    );
  }

  return (
    <div className="catalog-track-list">
      {tracks.map((track, index) => (
        <article className="catalog-track-card" key={track.id || `${release.id}-${index}`}>
          <div className="catalog-track-meta">
            <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{track.title || "Untitled track"}</strong>
              <span>
                {track.isrc || "ISRC pending"}
                {track.duration ? ` / ${track.duration}` : ""}
                {track.version ? ` / ${track.version}` : ""}
              </span>
            </div>
          </div>
          <WaveformPlayer src={getTrackAudioUrl(track)} title={`${track.title || "Track"} waveform`} />
        </article>
      ))}
    </div>
  );
};

const Catalog = ({ initialStatus = "all", heading = "Catalog Management", mode = "catalog" }) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [releases, setReleases] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    search: "",
    status: initialStatus,
    releaseType: "all",
    sort: "latest",
  });
  const [viewMode, setViewMode] = useState("table");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [metadataExporting, setMetadataExporting] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("approved");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [uploadingImport, setUploadingImport] = useState("");
  const [applyingImport, setApplyingImport] = useState(false);
  const [metadataFormat, setMetadataFormat] = useState("auto");
  const [metadataFormats, setMetadataFormats] = useState({ default_format: "auto", formats: {} });
  const [importPreview, setImportPreview] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const metadataInputRef = useRef(null);
  const dailyReportInputRef = useRef(null);
  const liveLinksInputRef = useRef(null);
  const releaseStatusInputRef = useRef(null);

  const query = useMemo(
    () => ({
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search,
      status: filters.status === "all" ? "" : filters.status,
      releaseType: filters.releaseType === "all" ? "" : filters.releaseType,
      sort: filters.sort,
    }),
    [filters, pagination.limit, pagination.page]
  );

  const loadReleases = useCallback(async () => {
    try {
      setLoading(true);
      const data = await releaseService.list(query);
      const nextReleases = data.releases || [];
      setReleases(nextReleases);
      setExpandedRows((current) => {
        const nextExpandedRows = { ...current };
        nextReleases.forEach((release) => {
          if (nextExpandedRows[release.id] === undefined) {
            nextExpandedRows[release.id] = false;
          }
        });
        return nextExpandedRows;
      });
      setPagination((current) => ({
        ...current,
        ...(data.pagination || {}),
      }));
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not load catalog." });
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    // Data loading is intentionally centralized here for filter and pagination changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReleases();
  }, [loadReleases]);

  useEffect(() => {
    let mounted = true;
    releaseService
      .getMetadataFormats()
      .then((data) => {
        if (!mounted) return;
        setMetadataFormats(data);
        setMetadataFormat(data.default_format || "auto");
      })
      .catch(() => {
        if (mounted) {
          setMetadataFormats({ default_format: "auto", formats: { v1: { enabled: true, label: "V1" }, v2: { enabled: true, label: "V2" } } });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const toggleRelease = (releaseId) => {
    setExpandedRows((current) => ({ ...current, [releaseId]: !(current[releaseId] ?? false) }));
  };

  const allVisibleSelected = releases.length > 0 && releases.every((release) => selectedIds.includes(String(release.id)));

  const toggleSelection = (releaseId) => {
    const normalizedId = String(releaseId);
    setSelectedIds((current) =>
      current.includes(normalizedId) ? current.filter((id) => id !== normalizedId) : [...current, normalizedId]
    );
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const visibleIds = releases.map((release) => String(release.id));
      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await releaseService.exportCatalog();
      setToast({ type: "success", message: "Catalog export downloaded." });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Catalog export failed." });
    } finally {
      setExporting(false);
    }
  };

  const handleMetadataExport = async (type) => {
    try {
      setMetadataExporting(type);
      await releaseService.exportMetadata(type);
      setToast({ type: "success", message: "Metadata export downloaded." });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Metadata export failed." });
    } finally {
      setMetadataExporting("");
    }
  };

  const handleMetadataTemplate = async (type) => {
    try {
      setMetadataExporting(`template-${type}`);
      await releaseService.downloadMetadataTemplate(type);
      setToast({ type: "success", message: "Metadata template downloaded." });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Template download failed." });
    } finally {
      setMetadataExporting("");
    }
  };

  const handleMetadataUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setUploadingImport("metadata");
      const formData = new FormData();
      formData.append("metadata", file);
      formData.append("format", metadataFormat);
      formData.append("uploaded_template_type", metadataFormat);
      const data = await releaseService.previewMetadataImport(formData);
      const preview = unwrapImportPreview(data);
      setImportPreview(preview);
      setToast({
        type: preview.summary?.failed_rows ? "info" : "success",
        message: `Metadata ${preview.summary?.detected_format || metadataFormat} preview: ${preview.summary?.success_count || 0} valid, ${preview.summary?.failed_rows || 0} failed.`,
      });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Metadata upload failed." });
    } finally {
      setUploadingImport("");
    }
  };

  const handleApplyMetadataImport = async () => {
    const importId = getImportId(importPreview);
    if (!importId) {
      setToast({ type: "error", message: "Upload preview did not return an import ID. Please upload the file again." });
      return;
    }

    try {
      setApplyingImport(true);
      const result = await releaseService.applyMetadataImport(importId);
      const payload = result.data || result;
      setToast({
        type: "success",
        message: `Created ${payload.created_releases || 0} draft release${payload.created_releases === 1 ? "" : "s"}.`,
      });
      setImportPreview(null);
      loadReleases();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Could not create drafts from metadata." });
    } finally {
      setApplyingImport(false);
    }
  };

  const handleErrorReportDownload = async () => {
    const importId = getImportId(importPreview);
    if (!importId) {
      setToast({ type: "error", message: "Upload preview did not return an import ID. Please upload the file again." });
      return;
    }
    try {
      await releaseService.downloadMetadataErrorReport(importId);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Error report download failed." });
    }
  };

  const handleDailyReportUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setUploadingImport("daily");
      const formData = new FormData();
      formData.append("report", file);
      const data = await releaseService.uploadDailyPlayReport(formData);
      setToast({
        type: "success",
        message: `Daily report imported: ${data.summary?.imported || 0} rows, ${data.summary?.unmatched || 0} unmatched.`,
      });
      loadReleases();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Daily play report upload failed." });
    } finally {
      setUploadingImport("");
    }
  };

  const handleLiveLinksUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setUploadingImport("links");
      const formData = new FormData();
      formData.append("links", file);
      const result = await releaseService.uploadLiveLinks(formData);
      const payload = result.data || result;
      setToast({ type: "success", message: `Live links imported: ${payload.linked || 0} links, ${payload.unmatched || 0} unmatched.` });
      loadReleases();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Live-link upload failed." });
    } finally {
      setUploadingImport("");
    }
  };

  const handleReleaseStatusUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setUploadingImport("status");
      const formData = new FormData();
      formData.append("status", file);
      const result = await releaseService.uploadReleaseStatus(formData);
      const payload = result.data || result;
      setToast({ type: "success", message: `Platform statuses imported: ${payload.updated || 0} updates, ${payload.unmatched || 0} unmatched.` });
      loadReleases();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Release-status upload failed." });
    } finally {
      setUploadingImport("");
    }
  };

  const handleBulkStatus = async () => {
    if (!selectedIds.length) {
      setToast({ type: "error", message: "Select releases first." });
      return;
    }

    try {
      setBulkLoading(true);
      const data = await releaseService.bulkUpdateStatus({
        releaseIds: selectedIds,
        status: bulkStatus,
        admin_notes: "Bulk catalog action",
      });
      setToast({ type: "success", message: data.message || "Bulk update complete." });
      setSelectedIds([]);
      loadReleases();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Bulk update failed." });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await releaseService.remove(deleteTarget.id);
      setToast({ type: "success", message: "Release deleted." });
      setDeleteTarget(null);
      loadReleases();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Delete failed." });
    }
  };

  const createPath = role === "artist" ? "/artist/submit-release" : role === "label" ? "/label/submit-release" : "/releases/new";
  const pageTitle = mode === "pending" ? "Pending Releases" : heading;

  return (
    <div className="page-stack release-workspace">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete release?"
        message={`This will permanently remove ${deleteTarget?.title || "this release"} and its uploaded assets.`}
        confirmLabel="Delete Release"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <input ref={metadataInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleMetadataUpload} />
      <input ref={dailyReportInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleDailyReportUpload} />
      <input ref={liveLinksInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleLiveLinksUpload} />
      <input ref={releaseStatusInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleReleaseStatusUpload} />

      <section className="admin-hero release-hero">
        <div>
          <p className="eyebrow">Catalog</p>
          <h2>{pageTitle}</h2>
          <p>Review submitted albums, inspect artwork, play waveform previews and manage approval workflow.</p>
        </div>
        <div className="hero-actions">
          {role === "admin" && (
            <>
              <button className="secondary-button" type="button" disabled={exporting} onClick={handleExport}>
                {exporting ? <Loader2 className="spin" size={17} /> : <FileSpreadsheet size={17} />}
                Catalog Excel
              </button>
              <button className="secondary-button" type="button" disabled={Boolean(metadataExporting)} onClick={() => handleMetadataExport("full")}>
                {metadataExporting === "full" ? <Loader2 className="spin" size={17} /> : <Activity size={17} />}
                Full Metadata
              </button>
              <button className="secondary-button" type="button" disabled={Boolean(uploadingImport)} onClick={() => liveLinksInputRef.current?.click()}>
                {uploadingImport === "links" ? <Loader2 className="spin" size={17} /> : <UploadCloud size={17} />}
                Live Links
              </button>
              <button className="secondary-button" type="button" disabled={Boolean(uploadingImport)} onClick={() => releaseStatusInputRef.current?.click()}>
                {uploadingImport === "status" ? <Loader2 className="spin" size={17} /> : <UploadCloud size={17} />}
                Platform Status
              </button>
            </>
          )}
          {["admin", "artist", "label"].includes(role) && (
            <>
              <select className="inline-select" value={metadataFormat} onChange={(event) => setMetadataFormat(event.target.value)}>
                <option value="auto">Auto Detect</option>
                {Object.entries(metadataFormats.formats || {})
                  .filter(([, config]) => config.enabled !== false)
                  .map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label || key.toUpperCase()}
                    </option>
                  ))}
              </select>
              {Object.entries(metadataFormats.formats || {})
                .filter(([, config]) => config.enabled !== false)
                .map(([key, config]) => (
                  <button className="secondary-button" key={key} type="button" disabled={Boolean(metadataExporting)} onClick={() => handleMetadataTemplate(key)}>
                    {metadataExporting === `template-${key}` ? <Loader2 className="spin" size={17} /> : <FileSpreadsheet size={17} />}
                    {config.label || key.toUpperCase()}
                  </button>
                ))}
              <button className="secondary-button" type="button" disabled={Boolean(uploadingImport)} onClick={() => metadataInputRef.current?.click()}>
                {uploadingImport === "metadata" ? <Loader2 className="spin" size={17} /> : <UploadCloud size={17} />}
                Bulk Metadata
              </button>
            </>
          )}
          {["admin", "accountant"].includes(role) && (
            <button className="secondary-button" type="button" disabled={Boolean(uploadingImport)} onClick={() => dailyReportInputRef.current?.click()}>
              {uploadingImport === "daily" ? <Loader2 className="spin" size={17} /> : <UploadCloud size={17} />}
              Daily Play Report
            </button>
          )}
          {["admin", "artist", "label"].includes(role) && (
            <Link className="primary-button" to={createPath}>
              <Plus size={17} />
              New Release
            </Link>
          )}
        </div>
      </section>

      <section className="catalog-toolbar">
        <label className="catalog-search">
          <Search size={17} />
          <input
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search title, artist, UPC, ISRC"
            type="search"
          />
        </label>

        <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All status" : status}
            </option>
          ))}
        </select>

        <select value={filters.releaseType} onChange={(event) => updateFilter("releaseType", event.target.value)}>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type === "all" ? "All types" : type.toUpperCase()}
            </option>
          ))}
        </select>

        <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
          <option value="latest">Latest created</option>
          <option value="release_date">Release date</option>
        </select>

        <div className="view-toggle">
          <button className={viewMode === "table" ? "active" : ""} type="button" onClick={() => setViewMode("table")} aria-label="Table view">
            <List size={17} />
          </button>
          <button className={viewMode === "cards" ? "active" : ""} type="button" onClick={() => setViewMode("cards")} aria-label="Card view">
            <Grid3X3 size={17} />
          </button>
        </div>
      </section>

      {role === "admin" && selectedIds.length > 0 && (
        <section className="bulk-action-toolbar">
          <div>
            <strong>{selectedIds.length} selected</strong>
            <span>Bulk catalog actions preserve existing assets and history.</span>
          </div>
          <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>
            {statusOptions
              .filter((status) => status !== "all")
              .map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
          </select>
          <button className="secondary-button" type="button" disabled={bulkLoading} onClick={handleBulkStatus}>
            {bulkLoading ? <Loader2 className="spin" size={17} /> : <CheckSquare size={17} />}
            Apply Status
          </button>
          <button className="ghost-button" type="button" onClick={() => setSelectedIds([])}>
            Clear
          </button>
        </section>
      )}

      {importPreview && (
        <section className="metadata-import-preview">
          <div>
            <p className="eyebrow">Metadata Import</p>
            <h3>
              {importPreview.summary?.detected_format?.toUpperCase() || metadataFormat.toUpperCase()} validation report
            </h3>
            <span>
              {importPreview.summary?.success_count || 0} valid / {importPreview.summary?.failed_rows || 0} failed / {importPreview.summary?.warning_rows || 0} warnings
            </span>
          </div>
          <div className="import-preview-actions">
            {(importPreview.summary?.failed_rows || 0) > 0 && (
              <button className="secondary-button" type="button" onClick={handleErrorReportDownload}>
                <Download size={16} />
                Error Report
              </button>
            )}
            <button className="primary-button" type="button" disabled={applyingImport || !(importPreview.summary?.success_count > 0)} onClick={handleApplyMetadataImport}>
              {applyingImport ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
              Create Drafts
            </button>
            <button className="ghost-button" type="button" onClick={() => setImportPreview(null)}>
              Dismiss
            </button>
          </div>
          <div className="import-preview-table">
            {(importPreview.rows || []).slice(0, 6).map((row) => (
              <article key={row.row_number} className={row.errors?.length ? "has-errors" : ""}>
                <strong>Row {row.row_number}: {row.normalized_data?.track_title || "Untitled"}</strong>
                <span>{row.normalized_data?.release_title || "No release"} / {row.normalized_data?.isrc || "ISRC blank"}</span>
                {row.errors?.length > 0 && <small>{row.errors.join("; ")}</small>}
                {!row.errors?.length && row.warnings?.length > 0 && <small>{row.warnings.join("; ")}</small>}
              </article>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <section className="catalog-skeleton">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="skeleton catalog-skeleton-row" key={index} />
          ))}
        </section>
      ) : releases.length === 0 ? (
        <section className="empty-state">
          <span>No Releases</span>
          <h2>No catalog items found</h2>
          <p>Try adjusting filters or submit a new release to begin catalog management.</p>
        </section>
      ) : viewMode === "table" ? (
        <section className="panel catalog-panel">
          <div className="table-wrap">
            <table className="data-table catalog-table">
              <thead>
                <tr>
                  {role === "admin" && (
                    <th className="select-column">
                      <button type="button" className="icon-only ghost" onClick={toggleAllVisible} aria-label={allVisibleSelected ? "Clear selection" : "Select all visible releases"}>
                        {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                  )}
                  <th>Release</th>
                  <th>Artist</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Tracks</th>
                  <th>Health</th>
                  <th>Delivery</th>
                  <th>Release Date</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => {
                  const isExpanded = expandedRows[release.id] ?? false;
                  const artworkUrl = getArtworkUrl(release);

                  return (
                    <Fragment key={release.id}>
                      <tr className="catalog-release-row" onClick={() => toggleRelease(release.id)}>
                        {role === "admin" && (
                          <td className="select-column" onClick={(event) => event.stopPropagation()}>
                            <button type="button" className="icon-only ghost" onClick={() => toggleSelection(release.id)} aria-label="Select release">
                              {selectedIds.includes(String(release.id)) ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                          </td>
                        )}
                        <td>
                          <div className="release-cell release-cell-accordion">
                            <button className="accordion-toggle" type="button" aria-label={isExpanded ? "Collapse tracks" : "Expand tracks"}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            {artworkUrl ? (
                              <img src={artworkUrl} alt={release.title} />
                            ) : (
                              <div className="artwork-placeholder">
                                <Disc3 size={18} />
                              </div>
                            )}
                            <div>
                              <strong>{release.title}</strong>
                              <span>{release.upc || "UPC not assigned"}</span>
                            </div>
                          </div>
                        </td>
                        <td>{release.primary_artist}</td>
                        <td>{release.label_name}</td>
                        <td>{release.release_type?.toUpperCase()}</td>
                        <td>{release.track_count || release.tracks?.length || 0}</td>
                        <td>
                          <div className="completion-pill">
                            <span style={{ width: `${release.metadata_completion_percentage || 0}%` }} />
                            <strong>{release.metadata_completion_percentage || 0}%</strong>
                          </div>
                          <small className="muted-inline">{release.qc_status || "qc pending"}</small>
                        </td>
                        <td>
                          <span className={`delivery-pill ${release.delivery_status || "pending"}`}>
                            {release.delivery_status || "pending"}
                          </span>
                        </td>
                        <td>{formatReleaseDate(release.release_date)}</td>
                        <td>
                          <StatusBadge status={release.status} />
                        </td>
                        <td>{formatReleaseDate(release.created_at)}</td>
                        <td>
                          <div className="table-actions" onClick={(event) => event.stopPropagation()}>
                            <button type="button" onClick={() => navigate(`/releases/${release.id}`)} aria-label="View release">
                              <Eye size={16} />
                            </button>
                            {release.artwork_download_url && (
                              <button type="button" onClick={() => releaseService.download(release.artwork_download_url, `${release.title}-artwork`)} aria-label="Download artwork">
                                <Download size={16} />
                              </button>
                            )}
                            {role === "admin" && (
                              <button type="button" onClick={() => setDeleteTarget(release)} aria-label="Delete release">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="track-accordion-row">
                          <td colSpan={role === "admin" ? 12 : 11}>
                            <div className="track-accordion-panel">
                              <div className="track-accordion-title">
                                <Music2 size={17} />
                                <strong>{release.tracks?.length || 0} track{(release.tracks?.length || 0) === 1 ? "" : "s"} under {release.title}</strong>
                              </div>
                              <TrackList release={release} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="catalog-card-grid">
          {releases.map((release) => {
            const artworkUrl = getArtworkUrl(release);

            return (
              <article className="release-card catalog-release-card" key={release.id}>
                {artworkUrl ? (
                  <img src={artworkUrl} alt={release.title} />
                ) : (
                  <div className="artwork-placeholder large">
                    <Disc3 size={30} />
                  </div>
                )}
                <div className="release-card-body">
                  <div className="release-card-title">
                    <div>
                      <strong>{release.title}</strong>
                      <span>{release.primary_artist}</span>
                    </div>
                    <StatusBadge status={release.status} />
                  </div>
                  <p>
                    {release.label_name} / {release.release_type?.toUpperCase()} / {formatReleaseDate(release.release_date)}
                  </p>
                  <div className="catalog-card-health">
                    <div className="completion-pill">
                      <span style={{ width: `${release.metadata_completion_percentage || 0}%` }} />
                      <strong>{release.metadata_completion_percentage || 0}% metadata</strong>
                    </div>
                    <span className={`delivery-pill ${release.delivery_status || "pending"}`}>
                      {release.delivery_status || "pending"}
                    </span>
                  </div>
                  <TrackList release={release} />
                  <div className="release-card-actions">
                    <button className="secondary-button" type="button" onClick={() => navigate(`/releases/${release.id}`)}>
                      <Eye size={16} />
                      Details
                    </button>
                    {release.artwork_download_url && (
                      <button className="secondary-button" type="button" onClick={() => releaseService.download(release.artwork_download_url, `${release.title}-artwork`)}>
                        <Download size={16} />
                        Artwork
                      </button>
                    )}
                    {role === "admin" && (
                      <button className="danger-icon-button" type="button" onClick={() => setDeleteTarget(release)} aria-label="Delete release">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {!loading && releases.length > 0 && (
        <section className="pagination-bar">
          <span>
            Page {pagination.page} of {pagination.totalPages} / {pagination.total} releases
          </span>
          <div>
            <button
              className="secondary-button"
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
            >
              Previous
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
            >
              Next
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default Catalog;
