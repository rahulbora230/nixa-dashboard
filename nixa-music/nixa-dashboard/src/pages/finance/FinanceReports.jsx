import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { financeService } from "../../services/financeService";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import "./Finance.css";

const reportTypes = [
  { value: "artist", label: "Artist-wise" },
  { value: "label", label: "Label-wise" },
  { value: "platform", label: "Platform-wise" },
  { value: "country", label: "Country-wise" },
  { value: "track", label: "Track-wise" },
  { value: "pending", label: "Pending payable" },
  { value: "monthly", label: "Monthly" },
  { value: "tax", label: "Tax deductions" },
];

const FinanceReports = () => {
  const [filters, setFilters] = useState({ search: "", reportMonth: "", platform: "", country: "", revenueStatus: "" });
  const [type, setType] = useState("artist");
  const [data, setData] = useState({ artistBreakdown: [], labelBreakdown: [], platformBreakdown: [], countryBreakdown: [], trackBreakdown: [], pendingPayables: [], monthlyTrend: [], taxSummary: {} });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const result = await financeService.getFinanceSummary(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load finance reports." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadReports, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  const rows = useMemo(() => {
    const source = {
      artist: data.artistBreakdown,
      label: data.labelBreakdown,
      platform: data.platformBreakdown,
      country: data.countryBreakdown,
      track: data.trackBreakdown,
      pending: data.pendingPayables,
      monthly: data.monthlyTrend,
      tax: [
        {
          name: "Tax deductions",
          gstDeduction: data.taxSummary?.gstDeduction || 0,
          tdsDeduction: data.taxSummary?.tdsDeduction || 0,
          pendingAmount: data.taxSummary?.totalDeductions || 0,
        },
      ],
    }[type] || [];

    return source.filter((row) => {
      if (!filters.search) {
        return true;
      }

      return String(row.name || row.month || "").toLowerCase().includes(filters.search.toLowerCase());
    });
  }, [data, filters.search, type]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const exportReport = async (format) => {
    try {
      await financeService.exportFinanceReport(type, format, filters);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Report export failed." });
    }
  };

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Finance Reports</p>
          <h2>Export monthly, artist, label, platform, pending and tax reports.</h2>
          <p>Reports use real calculated revenue, split history and finance balances.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={() => exportReport("csv")}>
            <Download size={17} />
            CSV
          </button>
          <button className="primary-button" type="button" onClick={() => exportReport("xlsx")}>
            <Download size={17} />
            Excel
          </button>
        </div>
      </section>

      <section className="finance-toolbar">
        <select value={type} onChange={(event) => setType(event.target.value)}>
          {reportTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="finance-search span-2">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search report rows" />
        </label>
        <input type="month" value={filters.reportMonth} onChange={(event) => updateFilter("reportMonth", event.target.value)} />
        <input value={filters.platform} onChange={(event) => updateFilter("platform", event.target.value)} placeholder="Platform" />
        <select value={filters.revenueStatus} onChange={(event) => updateFilter("revenueStatus", event.target.value)}>
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      </section>

      <section className="catalog-panel finance-table">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 8 }).map((_, index) => (
              <div className="catalog-skeleton-row skeleton" key={index} />
            ))}
          </div>
        ) : rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Streams</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Artist Share</th>
                  <th>Label Share</th>
                  <th>Company</th>
                  <th>Payable</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id || row.name || row.month}>
                    <td>{row.name || row.month || "Report row"}</td>
                    <td>{formatNumber(row.streams)}</td>
                    <td>{formatCurrency(row.grossRevenue)}</td>
                    <td>{formatCurrency(row.netRevenue)}</td>
                    <td>{formatCurrency(row.artistShare)}</td>
                    <td>{formatCurrency(row.labelShare)}</td>
                    <td>{formatCurrency(row.companyShare)}</td>
                    <td>{formatCurrency(row.payableAmount)}</td>
                    <td>{formatCurrency(row.pendingAmount || row.tdsDeduction || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="finance-empty">No report rows match the current filters.</div>
        )}
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default FinanceReports;
