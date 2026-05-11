import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search } from "lucide-react";
import PayoutStatusBadge from "../../components/payouts/PayoutStatusBadge";
import Toast from "../../components/ui/Toast";
import { invoiceService } from "../../services/invoiceService";
import { formatCurrency, formatDate, formatNumber } from "../../utils/formatters";
import "./Payouts.css";

const Invoices = () => {
  const [filters, setFilters] = useState({ search: "", page: 1, limit: 12 });
  const [data, setData] = useState({ invoices: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const result = await invoiceService.getInvoices(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load invoices." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadInvoices, 0);
    return () => window.clearTimeout(timer);
  }, [loadInvoices]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  const downloadInvoice = async (invoice) => {
    try {
      await invoiceService.downloadInvoice(invoice.id, invoice.invoiceNumber);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to download invoice." });
    }
  };

  return (
    <div className="page-stack payout-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Invoices</p>
          <h2>Professional payout invoice history.</h2>
          <p>Search, export and download generated royalty payout invoices.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={() => invoiceService.exportInvoices("csv", filters)}>
            <Download size={17} />
            CSV
          </button>
          <button className="primary-button" type="button" onClick={() => invoiceService.exportInvoices("xlsx", filters)}>
            <Download size={17} />
            Excel
          </button>
        </div>
      </section>

      <section className="payout-toolbar">
        <label className="payout-search span-3">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search invoice, recipient, reference" />
        </label>
      </section>

      <section className="catalog-panel payout-table">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 7 }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
          </div>
        ) : data.invoices.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Recipient</th>
                  <th>Gross</th>
                  <th>GST</th>
                  <th>TDS</th>
                  <th>Net</th>
                  <th>Payout Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><strong>{invoice.invoiceNumber}</strong></td>
                    <td>{invoice.recipientName}</td>
                    <td>{formatCurrency(invoice.grossAmount)}</td>
                    <td>{formatCurrency(invoice.gstDeduction)}</td>
                    <td>{formatCurrency(invoice.tdsDeduction)}</td>
                    <td>{formatCurrency(invoice.netAmount)}</td>
                    <td><PayoutStatusBadge status={invoice.payoutStatus || "completed"} /></td>
                    <td>{formatDate(invoice.createdAt)}</td>
                    <td>
                      <div className="payout-actions-inline">
                        <Link to={`/invoices/${invoice.id}`}>View</Link>
                        <button type="button" onClick={() => downloadInvoice(invoice)}>Download</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="payout-empty">No invoices generated yet.</div>
        )}
      </section>

      <div className="pagination-bar">
        <span>
          Page {data.pagination.page} of {data.pagination.totalPages} - {formatNumber(data.pagination.total)} invoices
        </span>
        <div>
          <button className="secondary-button" type="button" disabled={filters.page <= 1} onClick={() => updateFilter("page", filters.page - 1)}>Previous</button>
          <button className="secondary-button" type="button" disabled={filters.page >= data.pagination.totalPages} onClick={() => updateFilter("page", filters.page + 1)}>Next</button>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default Invoices;
