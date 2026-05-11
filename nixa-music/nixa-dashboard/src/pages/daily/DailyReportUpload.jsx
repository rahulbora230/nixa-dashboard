import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { dailyService } from "../../services/dailyService";
import { formatDate, formatNumber } from "../../utils/formatters";
import "./Daily.css";

const platforms = [
  "Spotify",
  "Apple Music",
  "YouTube",
  "YouTube Music",
  "Meta",
  "Instagram",
  "Facebook",
  "TikTok",
  "Amazon Music",
  "JioSaavn",
  "Wynk",
  "Boomplay",
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
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension !== "csv") {
    return [
      {
        File: file.name,
        Preview: "Excel files are validated during import.",
        Status: "Ready",
      },
    ];
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const headers = splitCsvLine(lines[0] || "").slice(0, 14);

  return lines.slice(1, 7).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => ({ ...row, [header || `Column ${index + 1}`]: values[index] || "" }), {});
  });
};

const validateFiles = (selectedFiles) => {
  const errors = [];
  const allowed = new Set(["csv", "xlsx", "xls"]);

  selectedFiles.forEach((file) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!allowed.has(extension)) {
      errors.push(`${file.name}: only CSV, XLSX or XLS files are accepted.`);
    }

    if (file.size > 25 * 1024 * 1024) {
      errors.push(`${file.name}: file must be below 25 MB.`);
    }
  });

  return errors;
};

const DailyReportUpload = () => {
  const [form, setForm] = useState({
    reportDate: new Date().toISOString().slice(0, 10),
    platform: "Spotify",
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

    if (!form.reportDate) {
      setErrors(["Report date is required."]);
      return;
    }

    if (!files.length) {
      setErrors(["Add at least one daily play report file."]);
      return;
    }

    const validationErrors = validateFiles(files);

    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("reportDate", form.reportDate);
    formData.append("platform", form.platform);

    try {
      setUploading(true);
      setProgress(0);
      const response = await dailyService.uploadReport(formData, (eventData) => {
        if (eventData.total) {
          setProgress(Math.round((eventData.loaded * 100) / eventData.total));
        }
      });

      setResults(response.results || []);
      setToast({ type: "success", message: "Daily play report import completed." });
      setFiles([]);
      setPreview([]);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Daily report upload failed." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-stack daily-workspace">
      <section className="admin-hero daily-hero compact-hero">
        <div>
          <p className="eyebrow">Daily Play Reports</p>
          <h2>Upload streaming reports for daily analytics and trend intelligence.</h2>
          <p>Rows are matched by ISRC or UPC, deduplicated, estimated for revenue, and flagged when catalog matches are missing.</p>
        </div>
      </section>

      <form className="daily-upload-layout" onSubmit={handleUpload}>
        <section className="daily-form-panel">
          <div className="form-section-heading">
            <FileSpreadsheet size={20} />
            <div>
              <h3>Report Metadata</h3>
              <p>Attach a platform and report date to the uploaded daily play report.</p>
            </div>
          </div>

          <div className="form-grid two-columns">
            <label>
              <span>Report date</span>
              <input
                type="date"
                value={form.reportDate}
                onChange={(event) => setForm((current) => ({ ...current, reportDate: event.target.value }))}
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
              {uploading ? `Uploading ${progress}%` : "Import Daily Report"}
            </button>
          </div>
        </section>

        <aside className="daily-upload-panel">
          <label className="daily-dropzone" onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
            <input type="file" accept=".csv,.xlsx,.xls" multiple onChange={(event) => handleFiles(event.target.files)} />
            <UploadCloud size={26} />
            <strong>Drop CSV or Excel reports</strong>
            <span>{files.length ? `${files.length} file selected` : "CSV/XLSX/XLS, up to 25 MB each"}</span>
          </label>

          {uploading ? (
            <div className="daily-progress">
              <span style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          {files.length ? (
            <div className="daily-selected-list">
              <div className="daily-soft-copy">{(totalSize / 1024 / 1024).toFixed(2)} MB selected</div>
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
        <section className="daily-preview-panel">
          <div className="panel-heading">
            <div>
              <h3>Import Preview</h3>
              <p>First rows from {files[0]?.name}</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table daily-preview-table">
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
              <p>Matched rows, duplicate rows, validation failures and unmatched ISRC counts.</p>
            </div>
          </div>
          <div className="import-result-grid">
            {results.map((result) => (
              <article key={result.import.id}>
                <div>
                  <CheckCircle2 size={19} />
                  <strong>{result.import.fileName}</strong>
                  <span className={`revenue-status-badge revenue-status-${result.import.status}`}>{result.import.status}</span>
                </div>
                <p>{result.duplicateImport ? "Duplicate import skipped" : "Daily report processed"}</p>
                <dl>
                  <div>
                    <dt>Rows</dt>
                    <dd>{formatNumber(result.summary.totalRows)}</dd>
                  </div>
                  <div>
                    <dt>Imported</dt>
                    <dd>{formatNumber(result.summary.importedRows)}</dd>
                  </div>
                  <div>
                    <dt>Duplicates</dt>
                    <dd>{formatNumber(result.summary.duplicateRows)}</dd>
                  </div>
                  <div>
                    <dt>Unmatched</dt>
                    <dd>{formatNumber(result.summary.unmatchedRows)}</dd>
                  </div>
                </dl>
                <span>{formatDate(result.import.createdAt)}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default DailyReportUpload;
