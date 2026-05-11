import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import RevenueStatusBadge from "../../components/revenue/RevenueStatusBadge";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { revenueService } from "../../services/revenueService";
import { formatCurrency, formatMonth, formatNumber } from "../../utils/formatters";
import "./Revenue.css";

const platformOptions = ["Spotify", "Apple Music", "YouTube", "Meta", "Instagram", "Facebook", "TikTok", "Amazon Music", "JioSaavn", "Wynk", "Boomplay", "Resso", "Others"];

const sortOptions = [
  { value: "latest", label: "Latest" },
  { value: "report_month", label: "Report month" },
  { value: "streams", label: "Streams" },
  { value: "gross_revenue", label: "Gross revenue" },
  { value: "net_revenue", label: "Net revenue" },
  { value: "artist_share", label: "Artist share" },
];

const RevenueTable = () => {
  const { role } = useAuth();
  const [filters, setFilters] = useState({
    search: "",
    platform: "",
    country: "",
    reportMonth: "",
    sort: "latest",
    page: 1,
    limit: 12,
  });
  const [data, setData] = useState({ records: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const canExport = ["admin", "accountant"].includes(role);

  const loadRevenue = useCallback(async () => {
    try {
      setLoading(true);
      const result = await revenueService.getRevenueList(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load revenue records." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadRevenue, 0);
    return () => window.clearTimeout(timer);
  }, [loadRevenue]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  const downloadExport = async (format) => {
    try {
      const response = await revenueService.exportRevenue(format, filters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `nixa-revenue.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Export failed." });
    }
  };

  return (
    <div className="page-stack revenue-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Revenue Ledger</p>
          <h2>Track-wise royalty records with split calculations.</h2>
          <p>Search by ISRC, UPC, track title or artist, then filter by platform, country and report month.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadRevenue}>
            <RefreshCw size={17} />
            Refresh
          </button>
          {canExport ? (
            <>
              <button className="secondary-button" type="button" onClick={() => downloadExport("csv")}>
                <Download size={17} />
                CSV
              </button>
              <button className="primary-button" type="button" onClick={() => downloadExport("xlsx")}>
                <Download size={17} />
                Excel
              </button>
            </>
          ) : null}
        </div>
      </section>

      <section className="catalog-toolbar revenue-toolbar">
        <div className="catalog-search">
          <Search size={17} />
          <input
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search ISRC, track, artist, UPC"
          />
        </div>
        <select value={filters.platform} onChange={(event) => updateFilter("platform", event.target.value)}>
          <option value="">All platforms</option>
          {platformOptions.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
        <input
          value={filters.country}
          onChange={(event) => updateFilter("country", event.target.value.toUpperCase())}
          placeholder="Country"
          maxLength={3}
        />
        <input
          type="month"
          value={filters.reportMonth}
          onChange={(event) => updateFilter("reportMonth", event.target.value)}
        />
        <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      <section className="catalog-panel">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 7 }).map((_, index) => (
              <div className="catalog-skeleton-row skeleton" key={index} />
            ))}
          </div>
        ) : data.records.length ? (
          <div className="table-wrap">
            <table className="data-table revenue-table revenue-ledger-table">
              <thead>
                <tr>
                  <th>ISRC</th>
                  <th>Track</th>
                  <th>Artist</th>
                  <th>Platform</th>
                  <th>Country</th>
                  <th>Streams</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Artist Share</th>
                  <th>Label Share</th>
                  <th>Month</th>
                  <th>Payout</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.isrc || "-"}</td>
                    <td>
                      <strong>{record.trackTitle}</strong>
                    </td>
                    <td>{record.artistName}</td>
                    <td>{record.platform}</td>
                    <td>{record.country}</td>
                    <td>{formatNumber(record.streams)}</td>
                    <td>{formatCurrency(record.grossRevenue)}</td>
                    <td>{formatCurrency(record.netRevenue)}</td>
                    <td>{formatCurrency(record.artistShare)}</td>
                    <td>{formatCurrency(record.labelShare)}</td>
                    <td>{formatMonth(record.reportMonth)}</td>
                    <td>
                      <RevenueStatusBadge status={record.payoutStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span>Revenue</span>
            <h2>No revenue records found</h2>
            <p>Try adjusting the filters or upload a royalty CSV report from the revenue import page.</p>
          </div>
        )}
      </section>

      <div className="pagination-bar">
        <span>
          Page {data.pagination.page} of {data.pagination.totalPages} - {formatNumber(data.pagination.total)} rows
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

export default RevenueTable;
