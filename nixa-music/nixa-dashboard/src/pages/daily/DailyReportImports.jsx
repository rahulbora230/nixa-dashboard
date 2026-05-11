import { useCallback, useEffect, useState } from "react";
import { Download, FileClock, RefreshCw, Search } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { dailyService } from "../../services/dailyService";
import { formatDate, formatNumber } from "../../utils/formatters";
import "./Daily.css";

const DailyReportImports = () => {
  const [filters, setFilters] = useState({ search: "", platform: "", reportDate: "", page: 1 });
  const [data, setData] = useState({ imports: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [unmatched, setUnmatched] = useState({ records: [], pagination: { total: 0 } });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadImports = useCallback(async () => {
    try {
      setLoading(true);
      const [importsResult, unmatchedResult] = await Promise.all([
        dailyService.getImports(filters),
        dailyService.getUnmatched({ ...filters, limit: 8 }),
      ]);
      setData(importsResult);
      setUnmatched(unmatchedResult);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load daily report imports." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadImports, 0);
    return () => window.clearTimeout(timer);
  }, [loadImports]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  const exportUnmatched = async () => {
    try {
      await dailyService.exportAnalytics({
        type: "unmatched",
        format: "xlsx",
        params: filters,
        filename: "nixa-unmatched-isrc.xlsx",
      });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unmatched export failed." });
    }
  };

  return (
    <div className="page-stack daily-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Daily Import History</p>
          <h2>Daily play report audit trail and unmatched ISRC review.</h2>
          <p>Inspect upload status, duplicates, validation failures and catalog rows that need metadata attention.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadImports}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <button className="primary-button" type="button" onClick={exportUnmatched}>
            <Download size={17} />
            Unmatched
          </button>
        </div>
      </section>

      <section className="daily-toolbar">
        <div className="catalog-search">
          <Search size={17} />
          <input
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search file or platform"
          />
        </div>
        <select value={filters.platform} onChange={(event) => updateFilter("platform", event.target.value)}>
          <option value="">All platforms</option>
          <option value="Spotify">Spotify</option>
          <option value="Apple Music">Apple Music</option>
          <option value="YouTube">YouTube</option>
          <option value="TikTok">TikTok</option>
          <option value="JioSaavn">JioSaavn</option>
        </select>
        <input type="date" value={filters.reportDate} onChange={(event) => updateFilter("reportDate", event.target.value)} />
      </section>

      <section className="catalog-panel">
        {loading ? (
          <div className="catalog-skeleton daily-skeleton-wrap">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="catalog-skeleton-row skeleton" key={index} />
            ))}
          </div>
        ) : data.imports.length ? (
          <div className="table-wrap">
            <table className="data-table daily-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Platform</th>
                  <th>Date</th>
                  <th>Rows</th>
                  <th>Imported</th>
                  <th>Duplicates</th>
                  <th>Failed</th>
                  <th>Unmatched</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.imports.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="revenue-file-cell">
                        <FileClock size={17} />
                        <span>{item.fileName}</span>
                      </div>
                    </td>
                    <td>{item.platform}</td>
                    <td>{formatDate(item.reportDate)}</td>
                    <td>{formatNumber(item.totalRows)}</td>
                    <td>{formatNumber(item.importedRows)}</td>
                    <td>{formatNumber(item.duplicateRows)}</td>
                    <td>{formatNumber(item.failedRows)}</td>
                    <td>{formatNumber(item.unmatchedRows)}</td>
                    <td>
                      <span className={`revenue-status-badge revenue-status-${item.status}`}>{item.status}</span>
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span>Daily Reports</span>
            <h2>No imports found</h2>
            <p>Daily play report batches will appear here after upload.</p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Unmatched ISRC Report</h3>
            <p>Rows imported without a catalog track match.</p>
          </div>
          <span className="period-pill">{formatNumber(unmatched.pagination.total)} rows</span>
        </div>
        {unmatched.records.length ? (
          <div className="table-wrap">
            <table className="data-table daily-table">
              <thead>
                <tr>
                  <th>ISRC</th>
                  <th>UPC</th>
                  <th>Track</th>
                  <th>Artist</th>
                  <th>Platform</th>
                  <th>Country</th>
                  <th>Streams</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.isrc || "-"}</td>
                    <td>{record.upc || "-"}</td>
                    <td>{record.trackTitle}</td>
                    <td>{record.artistName}</td>
                    <td>{record.platform}</td>
                    <td>{record.country}</td>
                    <td>{formatNumber(record.streams)}</td>
                    <td>{formatDate(record.reportDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="daily-empty-inline">No unmatched rows for the selected filters.</div>
        )}
      </section>

      <div className="pagination-bar">
        <span>
          Page {data.pagination.page} of {data.pagination.totalPages} - {formatNumber(data.pagination.total)} imports
        </span>
        <div>
          <button
            className="secondary-button"
            type="button"
            disabled={filters.page <= 1}
            onClick={() => updateFilter("page", filters.page - 1)}
          >
            Previous
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={filters.page >= data.pagination.totalPages}
            onClick={() => updateFilter("page", filters.page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default DailyReportImports;
