import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import PayoutStatusBadge from "../../components/payouts/PayoutStatusBadge";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { payoutService } from "../../services/payoutService";
import { formatCurrency, formatDate, formatNumber } from "../../utils/formatters";
import "./Payouts.css";

const MyPayouts = () => {
  const { role } = useAuth();
  const [data, setData] = useState({ payouts: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadPayouts = useCallback(async () => {
    try {
      setLoading(true);
      const result = role === "label" ? await payoutService.getLabelPayouts("me") : await payoutService.getArtistPayouts("me");
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load payouts." });
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    const timer = window.setTimeout(loadPayouts, 0);
    return () => window.clearTimeout(timer);
  }, [loadPayouts]);

  const pending = data.payouts.reduce((sum, payout) => sum + Number(payout.pendingAmount || 0), 0);
  const paid = data.payouts.reduce((sum, payout) => sum + (payout.status === "completed" ? Number(payout.netAmount || 0) : 0), 0);

  return (
    <div className="page-stack payout-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">My Payouts</p>
          <h2>Payout history, pending balance and payment status.</h2>
          <p>Review deductions, completed payments and payout queue status.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadPayouts}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <Link className="primary-button" to={role === "label" ? "/label/invoices" : "/artist/invoices"}>Invoices</Link>
        </div>
      </section>

      <section className="stats-grid four-columns">
        <article className="metric-card tone-cyan"><div><span>Pending Balance</span><strong>{formatCurrency(pending)}</strong><small>Awaiting payout</small></div></article>
        <article className="metric-card tone-purple"><div><span>Paid Amount</span><strong>{formatCurrency(paid)}</strong><small>Completed payouts</small></div></article>
        <article className="metric-card tone-magenta"><div><span>Payout Rows</span><strong>{formatNumber(data.pagination.total)}</strong><small>History rows</small></div></article>
        <article className="metric-card tone-green"><div><span>Portal</span><strong>{role}</strong><small>Secure role view</small></div></article>
      </section>

      <section className="catalog-panel payout-table">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 6 }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
          </div>
        ) : data.payouts.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net / Pending</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((payout) => (
                  <tr key={payout.id || payout.queueId}>
                    <td>{payout.recipientName}</td>
                    <td>{formatCurrency(payout.grossAmount)}</td>
                    <td>{formatCurrency(payout.deductions)}</td>
                    <td>{formatCurrency(payout.netAmount || payout.pendingAmount)}</td>
                    <td><PayoutStatusBadge status={payout.status} /></td>
                    <td>{payout.paymentMethod || "-"}</td>
                    <td>{payout.transactionReference || "-"}</td>
                    <td>{payout.payoutDate ? formatDate(payout.payoutDate) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="payout-empty">No payout history yet.</div>
        )}
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default MyPayouts;
