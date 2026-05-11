import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import RevenueStatusBadge from "../../components/revenue/RevenueStatusBadge";
import Toast from "../../components/ui/Toast";
import { revenueService } from "../../services/revenueService";
import { formatDate } from "../../utils/formatters";
import "./Revenue.css";

const platforms = [
  "Spotify",
  "Apple Music",
  "YouTube",
  "Meta",
  "Instagram",
  "Facebook",
  "TikTok",
  "Amazon Music",
  "JioSaavn",
  "Wynk",
  "Boomplay",
  "Resso",
  "Others",
];

const splitCsvLine = (line) => {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
};

const parsePreview = async (file) => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const headers = splitCsvLine(lines[0] || "").slice(0, 12);

  return lines.slice(1, 7).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => ({ ...row, [header || `Column ${index + 1}`]: values[index] || "" }), {});
  });
};

const validateFiles = (selectedFiles) => {
  const errors = [];

  selectedFiles.forEach((file) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension !== "csv") {
      errors.push(`${file.name}: only CSV files are accepted.`);
    }

    if (file.size > 20 * 1024 * 1024) {
      errors.push(`${file.name}: file must be below 20 MB.`);
    }
  });

  return errors;
};

const RevenueUpload = () => {
  const [form, setForm] = useState({
    reportMonth: "",
    platform: "Spotify",
    currency: "INR",
    notes: "",
  });
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [toast, setToast] = useState(null);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  const handleFiles = async (fileList) => {
    const selected = Array.from(fileList || []);
    const validationErrors = validateFiles(selected);
    setErrors(validationErrors);
    setFiles(selected);
    setResults([]);

    if (selected[0] && validationErrors.length === 0) {
      setPreview(await parsePreview(selected[0]));
    } else {
      setPreview([]);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const removeFile = (fileName) => {
    const nextFiles = files.filter((file) => file.name !== fileName);
    setFiles(nextFiles);
    setPreview([]);
    setErrors(validateFiles(nextFiles));
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!form.reportMonth) {
      setErrors(["Report month is required."]);
      return;
    }

    if (!files.length) {
      setErrors(["Add at least one royalty CSV file."]);
      return;
    }

    const validationErrors = validateFiles(files);

    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("reportMonth", form.reportMonth);
    formData.append("platform", form.platform);
    formData.append("currency", form.currency);
    formData.append("notes", form.notes);

    try {
      setUploading(true);
      setProgress(0);
      const response = await revenueService.uploadRevenue(formData, (eventData) => {
        if (eventData.total) {
          setProgress(Math.round((eventData.loaded * 100) / eventData.total));
        }
      });

      setResults(response.results || []);
      setToast({ type: "success", message: "Revenue import completed." });
      setFiles([]);
      setPreview([]);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Revenue upload failed." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-stack revenue-workspace">
      <section className="admin-hero revenue-hero compact-hero">
        <div>
          <p className="eyebrow">Revenue Import</p>
          <h2>Upload DSP royalty CSVs for normalization and automatic split calculation.</h2>
          <p>CSV rows are stored raw, matched by ISRC, deduplicated and converted into payable artist and label shares.</p>
        </div>
      </section>

      <form className="revenue-upload-layout" onSubmit={handleUpload}>
        <section className="revenue-form-panel">
          <div className="form-section-heading">
            <FileSpreadsheet size={20} />
            <div>
              <h3>Report Metadata</h3>
              <p>Platform, month and currency attached to this import batch</p>
            </div>
          </div>

          <div className="form-grid two-columns">
            <label>
              <span>Report month</span>
              <input
                type="month"
                value={form.reportMonth}
                onChange={(event) => setForm((current) => ({ ...current, reportMonth: event.target.value }))}
              />
            </label>
            <label>
              <span>Platform</span>
              <select
                value={form.platform}
                onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value }))}
              >
                {platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Currency</span>
              <select
                value={form.currency}
                onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>
            <label>
              <span>Notes</span>
              <input
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Batch reference"
              />
            </label>
          </div>

          {errors.length ? (
            <div className="validation-panel">
              <AlertCircle size={19} />
              <div>
                <strong>Validation</strong>
                {errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="submit-actions">
            <button className="primary-button" type="submit" disabled={uploading}>
              <UploadCloud size={17} />
              {uploading ? `Uploading ${progress}%` : "Import Revenue"}
            </button>
          </div>
        </section>

        <aside className="revenue-upload-panel">
          <label className="revenue-dropzone" onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
            <input type="file" accept=".csv" multiple onChange={(event) => handleFiles(event.target.files)} />
            <UploadCloud size={26} />
            <strong>Drop royalty CSV files</strong>
            <span>{files.length ? `${files.length} file selected` : "CSV only, up to 20 MB each"}</span>
          </label>

          {uploading ? (
            <div className="upload-progress">
              <span style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          {files.length ? (
            <div className="selected-file-list">
              <div className="soft-copy">{(totalSize / 1024 / 1024).toFixed(2)} MB selected</div>
              {files.map((file) => (
                <div key={file.name}>
                  <FileSpreadsheet size={16} />
                  <span>{file.name}</span>
                  <button type="button" onClick={() => removeFile(file.name)} aria-label={`Remove ${file.name}`}>
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </form>

      {preview.length ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>CSV Preview</h3>
              <p>First rows from {files[0]?.name}</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table revenue-table">
              <thead>
                <tr>
                  {Object.keys(preview[0]).map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index}>
                    {Object.entries(row).map(([header, value]) => (
                      <td key={header}>{value || "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {results.length ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Import Summary</h3>
              <p>Processed files and duplicate prevention status</p>
            </div>
          </div>
          <div className="import-result-grid">
            {results.map((result) => (
              <article key={result.import.id}>
                <div>
                  <CheckCircle2 size={19} />
                  <strong>{result.import.file_name || result.import.fileName}</strong>
                  <RevenueStatusBadge status={result.import.status} />
                </div>
                <p>{result.duplicateImport ? "Duplicate import skipped" : "Import processed"}</p>
                <dl>
                  <div>
                    <dt>Rows</dt>
                    <dd>{result.summary.totalRows}</dd>
                  </div>
                  <div>
                    <dt>Imported</dt>
                    <dd>{result.summary.importedRows}</dd>
                  </div>
                  <div>
                    <dt>Duplicates</dt>
                    <dd>{result.summary.duplicateRows}</dd>
                  </div>
                  <div>
                    <dt>Unmatched</dt>
                    <dd>{result.summary.unmatchedRows}</dd>
                  </div>
                </dl>
                <span>{formatDate(result.import.created_at || result.import.createdAt)}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default RevenueUpload;
