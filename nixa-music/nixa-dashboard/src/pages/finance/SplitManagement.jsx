import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Percent, RefreshCw, Search } from "lucide-react";
import ConfirmModal from "../../components/ui/ConfirmModal";
import Toast from "../../components/ui/Toast";
import { financeService } from "../../services/financeService";
import { formatDate } from "../../utils/formatters";
import "./Finance.css";

const initialForm = {
  split_type: "artist",
  artist_id: "",
  label_id: "",
  release_id: "",
  track_id: "",
  isrc: "",
  artist_percentage: 80,
  label_percentage: 0,
  company_percentage: 20,
  effective_from: "2000-01-01",
  effective_to: "",
  status: "active",
  notes: "",
};

const SplitManagement = () => {
  const [filters, setFilters] = useState({ search: "", status: "", splitType: "", page: 1, limit: 12 });
  const [form, setForm] = useState(initialForm);
  const [data, setData] = useState({ splits: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const totalPercentage = useMemo(
    () => Number(form.artist_percentage || 0) + Number(form.label_percentage || 0) + Number(form.company_percentage || 0),
    [form]
  );

  const loadSplits = useCallback(async () => {
    try {
      setLoading(true);
      const result = await financeService.getSplits(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load splits." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadSplits, 0);
    return () => window.clearTimeout(timer);
  }, [loadSplits]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  const updateForm = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (["artist_percentage", "label_percentage"].includes(key)) {
        const artist = Number(next.artist_percentage || 0);
        const label = Number(next.label_percentage || 0);
        next.company_percentage = Math.max(100 - artist - label, 0);
      }

      return next;
    });
  };

  const submitSplit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      await financeService.createSplit(form);
      setToast({ type: "success", message: "Split created and stored in history." });
      setForm(initialForm);
      loadSplits();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to create split." });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (split) => {
    try {
      const nextStatus = split.status === "active" ? "inactive" : "active";
      await financeService.updateSplitStatus(split.id, nextStatus);
      setToast({ type: "success", message: `Split marked ${nextStatus}.` });
      loadSplits();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update status." });
    }
  };

  const recalculate = async () => {
    try {
      setRecalculating(true);
      const response = await financeService.recalculateSplits({});
      setToast({ type: "success", message: `Recalculated ${response.result.recalculatedRows} rows.` });
      setConfirmOpen(false);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to recalculate splits." });
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Split Management</p>
          <h2>Create time-aware artist, label, track and release split rules.</h2>
          <p>New split changes create history records, so old reporting months keep their original calculation logic.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadSplits}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <button className="primary-button" type="button" onClick={() => setConfirmOpen(true)}>
            <Percent size={17} />
            Recalculate
          </button>
        </div>
      </section>

      <form className="split-form" onSubmit={submitSplit}>
        <select value={form.split_type} onChange={(event) => updateForm("split_type", event.target.value)}>
          <option value="artist">Artist split</option>
          <option value="label">Label split</option>
          <option value="track">Track-specific split</option>
          <option value="release">Release-specific split</option>
        </select>
        <input value={form.artist_id} onChange={(event) => updateForm("artist_id", event.target.value)} placeholder="Artist UUID" />
        <input value={form.label_id} onChange={(event) => updateForm("label_id", event.target.value)} placeholder="Label UUID" />
        <input value={form.release_id} onChange={(event) => updateForm("release_id", event.target.value)} placeholder="Release UUID" />
        <input value={form.track_id} onChange={(event) => updateForm("track_id", event.target.value)} placeholder="Track UUID" />
        <input value={form.isrc} onChange={(event) => updateForm("isrc", event.target.value.toUpperCase())} placeholder="ISRC" />
        <input type="number" min="0" max="100" value={form.artist_percentage} onChange={(event) => updateForm("artist_percentage", event.target.value)} placeholder="Artist %" />
        <input type="number" min="0" max="100" value={form.label_percentage} onChange={(event) => updateForm("label_percentage", event.target.value)} placeholder="Label %" />
        <input type="number" min="0" max="100" value={form.company_percentage} onChange={(event) => updateForm("company_percentage", event.target.value)} placeholder="Company %" />
        <input type="date" value={form.effective_from} onChange={(event) => updateForm("effective_from", event.target.value)} />
        <input type="date" value={form.effective_to} onChange={(event) => updateForm("effective_to", event.target.value)} />
        <select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <textarea className="span-3" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Notes" />
        <div className="panel span-2">
          <div className="split-percent">
            <span>Artist {Number(form.artist_percentage || 0)}%</span>
            <span>Label {Number(form.label_percentage || 0)}%</span>
            <span>Company {Number(form.company_percentage || 0)}%</span>
            <span>Total {totalPercentage}%</span>
          </div>
        </div>
        <button className="primary-button span-1" type="submit" disabled={saving || Math.abs(totalPercentage - 100) > 0.01}>
          {saving ? "Saving..." : "Create Split"}
        </button>
      </form>

      <section className="finance-toolbar">
        <label className="finance-search span-2">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search split history" />
        </label>
        <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={filters.splitType} onChange={(event) => updateFilter("splitType", event.target.value)}>
          <option value="">All split types</option>
          <option value="artist">Artist</option>
          <option value="label">Label</option>
          <option value="track">Track</option>
          <option value="release">Release</option>
        </select>
        <button className="secondary-button" type="button" onClick={() => financeService.exportFinanceReport("artist", "xlsx")}>
          <Download size={17} />
          Export
        </button>
      </section>

      <section className="catalog-panel finance-table">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="catalog-skeleton-row skeleton" key={index} />
            ))}
          </div>
        ) : data.splits.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Owner</th>
                  <th>ISRC</th>
                  <th>Percentages</th>
                  <th>Effective</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.splits.map((split) => (
                  <tr key={split.id}>
                    <td>{split.splitType}</td>
                    <td>{split.artistName || split.labelName || split.trackTitle || split.releaseTitle || "Default rule"}</td>
                    <td>{split.isrc || "-"}</td>
                    <td>
                      <div className="split-percent">
                        <span>A {split.artistPercentage}%</span>
                        <span>L {split.labelPercentage}%</span>
                        <span>C {split.companyPercentage}%</span>
                      </div>
                    </td>
                    <td>
                      {formatDate(split.effectiveFrom)} to {split.effectiveTo ? formatDate(split.effectiveTo) : "Open"}
                    </td>
                    <td>
                      <span className={`finance-badge ${split.status}`}>{split.status}</span>
                    </td>
                    <td>
                      <button className="secondary-button" type="button" onClick={() => toggleStatus(split)}>
                        {split.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="finance-empty">No splits yet. Create the first 80/20 rule to begin.</div>
        )}
      </section>

      <div className="pagination-bar">
        <span>
          Page {data.pagination.page} of {data.pagination.totalPages}
        </span>
        <div>
          <button className="secondary-button" type="button" disabled={filters.page <= 1} onClick={() => updateFilter("page", filters.page - 1)}>
            Previous
          </button>
          <button className="secondary-button" type="button" disabled={filters.page >= data.pagination.totalPages} onClick={() => updateFilter("page", filters.page + 1)}>
            Next
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Recalculate splits?"
        message="This applies the latest effective split rules to existing calculated revenue rows."
        confirmLabel={recalculating ? "Recalculating..." : "Recalculate"}
        onConfirm={recalculate}
        onCancel={() => setConfirmOpen(false)}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default SplitManagement;
