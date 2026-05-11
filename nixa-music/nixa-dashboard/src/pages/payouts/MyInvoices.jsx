import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { invoiceService } from "../../services/invoiceService";
import { formatCurrency, formatDate } from "../../utils/formatters";
import "./Payouts.css";

const MyInvoices = () => {
  const [data, setData] = useState({ invoices: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const result = await invoiceService.getInvoices();
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load invoices." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadInvoices, 0);
    return () => window.clearTimeout(timer);
  }, [loadInvoices]);

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
          <p className="eyebrow">My Invoices</p>
          <h2>Download payout invoices and statements.</h2>
          <p>Secure invoice history for your royalty payouts.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadInvoices}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      <section className="catalog-panel payout-table">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 6 }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
          </div>
        ) : data.invoices.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Recipient</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th>Payment Date</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.recipientName}</td>
                    <td>{formatCurrency(invoice.grossAmount)}</td>
                    <td>{formatCurrency(invoice.gstDeduction + invoice.tdsDeduction)}</td>
                    <td>{formatCurrency(invoice.netAmount)}</td>
                    <td>{invoice.paymentDate ? formatDate(invoice.paymentDate) : "-"}</td>
                    <td>
                      <button className="secondary-button" type="button" onClick={() => downloadInvoice(invoice)}>
                        <Download size={16} />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="payout-empty">No invoices available yet.</div>
        )}
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default MyInvoices;
