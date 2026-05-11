import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, FileText, RefreshCw } from "lucide-react";
import PayoutStatusBadge from "../../components/payouts/PayoutStatusBadge";
import Toast from "../../components/ui/Toast";
import { invoiceService } from "../../services/invoiceService";
import { payoutService } from "../../services/payoutService";
import { formatCurrency, formatDate } from "../../utils/formatters";
import "./Payouts.css";

const PayoutDetails = () => {
  const { id } = useParams();
  const [payout, setPayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadPayout = useCallback(async () => {
    try {
      setLoading(true);
      const result = await payoutService.getPayout(id);
      setPayout(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load payout details." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(loadPayout, 0);
    return () => window.clearTimeout(timer);
  }, [loadPayout]);

  const updateStatus = async (status) => {
    try {
      await payoutService.updateStatus(payout.id, status, `Marked ${status} from payout details.`);
      setToast({ type: "success", message: `Payout marked ${status}.` });
      loadPayout();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update payout status." });
    }
  };

  const generateInvoice = async () => {
    try {
      const response = await invoiceService.generateInvoice(payout.id);
      setToast({ type: "success", message: "Invoice generated." });
      await invoiceService.downloadInvoice(response.invoice.id, response.invoice.invoiceNumber);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to generate invoice." });
    }
  };

  if (loading) {
    return <div className="metric-card skeleton" />;
  }

  if (!payout) {
    return <div className="payout-empty">Payout not found.</div>;
  }

  return (
    <div className="page-stack payout-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Payout Details</p>
          <h2>{payout.recipientName}</h2>
          <p>{payout.recipientType} payout record and audit activity.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadPayout}>
            <RefreshCw size={17} />
            Refresh
          </button>
          {payout.id ? (
            <button className="primary-button" type="button" onClick={generateInvoice}>
              <Download size={17} />
              Generate Invoice
            </button>
          ) : null}
          <Link className="secondary-button" to="/payouts/queue">
            Queue
          </Link>
        </div>
      </section>

      <section className="stats-grid four-columns">
        <article className="metric-card tone-cyan"><div><span>Gross Revenue</span><strong>{formatCurrency(payout.grossAmount)}</strong><small>Revenue base</small></div></article>
        <article className="metric-card tone-purple"><div><span>Deductions</span><strong>{formatCurrency(payout.deductions)}</strong><small>GST + TDS</small></div></article>
        <article className="metric-card tone-magenta"><div><span>Net Payable</span><strong>{formatCurrency(payout.netAmount || payout.pendingAmount)}</strong><small>Payout amount</small></div></article>
        <article className="metric-card tone-green"><div><span>Status</span><strong><PayoutStatusBadge status={payout.status} /></strong><small>{payout.payoutDate ? formatDate(payout.payoutDate) : "No date"}</small></div></article>
      </section>

      <section className="payout-section-grid">
        <article className="panel invoice-preview">
          <div className="panel-heading">
            <div>
              <h3>Payment Information</h3>
              <p>Method, reference and payout notes</p>
            </div>
          </div>
          <dl>
            <div><dt>Payment Method</dt><dd>{payout.paymentMethod || "Not set"}</dd></div>
            <div><dt>Transaction Reference</dt><dd>{payout.transactionReference || "Not set"}</dd></div>
            <div><dt>Payout Date</dt><dd>{payout.payoutDate ? formatDate(payout.payoutDate) : "Not set"}</dd></div>
            <div><dt>Applied At</dt><dd>{payout.appliedAt ? formatDate(payout.appliedAt) : "Not applied"}</dd></div>
            <div className="span-2"><dt>Notes</dt><dd>{payout.notes || "No notes"}</dd></div>
          </dl>
          {payout.id ? (
            <div className="payout-actions-inline">
              {payout.status === "processing" ? <button type="button" onClick={() => updateStatus("completed")}>Mark Completed</button> : null}
              {["pending", "processing"].includes(payout.status) ? <button type="button" onClick={() => updateStatus("failed")}>Mark Failed</button> : null}
              {["pending", "processing"].includes(payout.status) ? <button type="button" onClick={() => updateStatus("cancelled")}>Cancel</button> : null}
            </div>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Activity Log</h3>
              <p>Status movement and manual actions</p>
            </div>
            <FileText size={20} />
          </div>
          <div className="payout-mini-list">
            {payout.logs?.length ? payout.logs.map((log) => (
              <div className="payout-mini-row" key={log.id}>
                <div>
                  <strong>{log.action}</strong>
                  <span>{log.oldStatus || "-"} to {log.newStatus || "-"}</span>
                </div>
                <small>{formatDate(log.createdAt)}</small>
              </div>
            )) : <div className="payout-empty">No payout logs yet.</div>}
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default PayoutDetails;
