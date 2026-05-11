import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, RefreshCw } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { invoiceService } from "../../services/invoiceService";
import { formatCurrency, formatDate } from "../../utils/formatters";
import "./Payouts.css";

const InvoiceDetails = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const result = await invoiceService.getInvoice(id);
      setInvoice(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load invoice." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(loadInvoice, 0);
    return () => window.clearTimeout(timer);
  }, [loadInvoice]);

  const downloadInvoice = async () => {
    try {
      await invoiceService.downloadInvoice(invoice.id, invoice.invoiceNumber);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to download invoice." });
    }
  };

  if (loading) {
    return <div className="metric-card skeleton" />;
  }

  if (!invoice) {
    return <div className="payout-empty">Invoice not found.</div>;
  }

  return (
    <div className="page-stack payout-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Invoice Details</p>
          <h2>{invoice.invoiceNumber}</h2>
          <p>{invoice.recipientName} payout invoice.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadInvoice}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <button className="primary-button" type="button" onClick={downloadInvoice}>
            <Download size={17} />
            Download PDF
          </button>
          <Link className="secondary-button" to="/invoices">Invoices</Link>
        </div>
      </section>

      <section className="invoice-preview">
        <div className="panel-heading">
          <div>
            <h3>Nixa Music Royalty Payout Invoice</h3>
            <p>Professional invoice record generated from payout data</p>
          </div>
        </div>
        <dl>
          <div><dt>Invoice Number</dt><dd>{invoice.invoiceNumber}</dd></div>
          <div><dt>Recipient</dt><dd>{invoice.recipientName}</dd></div>
          <div><dt>Recipient Type</dt><dd>{invoice.recipientType}</dd></div>
          <div><dt>GST Number</dt><dd>{invoice.gstNumber || "Not provided"}</dd></div>
          <div><dt>PAN Number</dt><dd>{invoice.panNumber || "Not provided"}</dd></div>
          <div><dt>Address</dt><dd>{invoice.billingAddress || "Not provided"}</dd></div>
          <div><dt>Revenue Period</dt><dd>{invoice.invoicePeriodStart ? formatDate(invoice.invoicePeriodStart) : "All"} to {invoice.invoicePeriodEnd ? formatDate(invoice.invoicePeriodEnd) : "Current"}</dd></div>
          <div><dt>Payment Date</dt><dd>{invoice.paymentDate ? formatDate(invoice.paymentDate) : "Not set"}</dd></div>
          <div><dt>Gross Revenue</dt><dd>{formatCurrency(invoice.grossAmount)}</dd></div>
          <div><dt>GST Deduction</dt><dd>{formatCurrency(invoice.gstDeduction)}</dd></div>
          <div><dt>TDS Deduction</dt><dd>{formatCurrency(invoice.tdsDeduction)}</dd></div>
          <div><dt>Net Payable</dt><dd>{formatCurrency(invoice.netAmount)}</dd></div>
          <div><dt>Payment Method</dt><dd>{invoice.paymentMethod || "Not set"}</dd></div>
          <div><dt>Reference</dt><dd>{invoice.transactionReference || "Not set"}</dd></div>
        </dl>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default InvoiceDetails;
