import { useCallback, useEffect, useState } from "react";
import { FileClock, RefreshCw, Search } from "lucide-react";
import RevenueStatusBadge from "../../components/revenue/RevenueStatusBadge";
import Toast from "../../components/ui/Toast";
import { revenueService } from "../../services/revenueService";
import { formatDate, formatMonth, formatNumber } from "../../utils/formatters";
import "./Revenue.css";

const RevenueImports = () => {
  const [filters, setFilters] = useState({ search: "", platform: "", reportMonth: "", page: 1 });
  const [data, setData] = useState({ imports: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadImports = useCallback(async () => {
    try {
      setLoading(true);
      const result = await revenueService.getImports(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load import history." });
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

  return (
    <div className="page-stack revenue-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Import History</p>
          <h2>Revenue ingestion audit trail.</h2>
          <p>Review file batches, duplicate rows, failed rows and unmatched ISRCs from royalty imports.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadImports}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      <section className="catalog-toolbar revenue-toolbar">
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
          <option value="JioSaavn">JioSaavn</option>
          <option value="Meta">Meta</option>
          <option value="TikTok">TikTok</option>
        </select>
        <input
          type="month"
          value={filters.reportMonth}
          onChange={(event) => updateFilter("reportMonth", event.target.value)}
        />
      </section>

      <section className="catalog-panel">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="catalog-skeleton-row skeleton" key={index} />
            ))}
          </div>
        ) : data.imports.length ? (
          <div className="table-wrap">
            <table className="data-table revenue-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Platform</th>
                  <th>Month</th>
                  <th>Rows</th>
                  <th>Imported</th>
                  <th>Duplicates</th>
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
                    <td>{formatMonth(item.reportMonth)}</td>
                    <td>{formatNumber(item.totalRows)}</td>
                    <td>{formatNumber(item.importedRows)}</td>
                    <td>{formatNumber(item.duplicateRows)}</td>
                    <td>{formatNumber(item.unmatchedRows)}</td>
                    <td>
                      <RevenueStatusBadge status={item.status} />
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span>Revenue</span>
            <h2>No imports found</h2>
            <p>Uploaded royalty CSV batches will appear here with status, row counts and duplicate summaries.</p>
          </div>
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

export default RevenueImports;
