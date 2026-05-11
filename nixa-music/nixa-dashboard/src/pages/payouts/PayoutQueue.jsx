import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw, Search } from "lucide-react";
import PayoutStatusBadge from "../../components/payouts/PayoutStatusBadge";
import ConfirmModal from "../../components/ui/ConfirmModal";
import Toast from "../../components/ui/Toast";
import { payoutService } from "../../services/payoutService";
import { formatCurrency, formatDate, formatNumber } from "../../utils/formatters";
import "./Payouts.css";

const paymentMethods = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "paypal", label: "PayPal" },
  { value: "wise", label: "Wise" },
  { value: "razorpay", label: "Razorpay" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  recipientType: "artist",
  artistId: "",
  labelId: "",
  amount: "",
  paymentMethod: "bank_transfer",
  transactionReference: "",
  payoutDate: new Date().toISOString().slice(0, 10),
  gstDeduction: 0,
  tdsDeduction: 0,
  notes: "",
  status: "completed",
};

const PayoutQueue = () => {
  const [filters, setFilters] = useState({ search: "", status: "", sort: "pending", page: 1, limit: 12 });
  const [data, setData] = useState({ payouts: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const loadPayouts = useCallback(async () => {
    try {
      setLoading(true);
      const result = await payoutService.getPayouts(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load payout queue." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadPayouts, 0);
    return () => window.clearTimeout(timer);
  }, [loadPayouts]);

  const selectedRows = useMemo(
    () => data.payouts.filter((payout) => selected.includes(payout.id || payout.queueId)),
    [data.payouts, selected]
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const fillFromRow = (payout) => {
    setForm({
      ...emptyForm,
      recipientType: payout.recipientType,
      artistId: payout.artistId || "",
      labelId: payout.labelId || "",
      amount: payout.pendingAmount || payout.netAmount || "",
      tdsDeduction: payout.deductions || 0,
      notes: `Payout for ${payout.recipientName}`,
      status: "completed",
    });
  };

  const submitPayout = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      await payoutService.processPayout({
        artistId: form.recipientType === "artist" ? form.artistId : undefined,
        labelId: form.recipientType === "label" ? form.labelId : undefined,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        transactionReference: form.transactionReference,
        payoutDate: form.payoutDate,
        gstDeduction: Number(form.gstDeduction || 0),
        tdsDeduction: Number(form.tdsDeduction || 0),
        notes: form.notes,
        status: form.status,
      });
      setToast({ type: "success", message: "Payout processed." });
      setForm(emptyForm);
      setSelected([]);
      loadPayouts();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to process payout." });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (payout, status) => {
    try {
      await payoutService.updateStatus(payout.id, status, `Marked ${status} from payout queue.`);
      setToast({ type: "success", message: `Payout marked ${status}.` });
      loadPayouts();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update payout status." });
    }
  };

  const bulkProcess = async () => {
    try {
      setSaving(true);

      for (const row of selectedRows.filter((item) => item.status === "pending")) {
        await payoutService.processPayout({
          artistId: row.recipientType === "artist" ? row.artistId : undefined,
          labelId: row.recipientType === "label" ? row.labelId : undefined,
          amount: row.pendingAmount || row.netAmount,
          paymentMethod: "bank_transfer",
          notes: `Bulk payout queued for ${row.recipientName}`,
          status: "processing",
        });
      }

      setToast({ type: "success", message: `Queued ${selectedRows.length} payouts for processing.` });
      setBulkOpen(false);
      setSelected([]);
      loadPayouts();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Bulk payout failed." });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelected = (id) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <div className="page-stack payout-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Payout Queue</p>
          <h2>Process artist and label payouts with status controls.</h2>
          <p>Move payouts through pending, processing, completed, failed and cancelled states with audit logs.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadPayouts}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <button className="secondary-button" type="button" onClick={() => payoutService.exportPayouts("pending", "csv", filters)}>
            <Download size={17} />
            CSV
          </button>
          <button className="primary-button" type="button" disabled={!selectedRows.length} onClick={() => setBulkOpen(true)}>
            Bulk Process
          </button>
        </div>
      </section>

      <form className="payout-form" onSubmit={submitPayout}>
        <select value={form.recipientType} onChange={(event) => updateForm("recipientType", event.target.value)}>
          <option value="artist">Artist payout</option>
          <option value="label">Label payout</option>
        </select>
        <input value={form.artistId} onChange={(event) => updateForm("artistId", event.target.value)} placeholder="Artist UUID" disabled={form.recipientType !== "artist"} />
        <input value={form.labelId} onChange={(event) => updateForm("labelId", event.target.value)} placeholder="Label UUID" disabled={form.recipientType !== "label"} />
        <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} placeholder="Amount" />
        <select value={form.paymentMethod} onChange={(event) => updateForm("paymentMethod", event.target.value)}>
          {paymentMethods.map((method) => (
            <option key={method.value} value={method.value}>{method.label}</option>
          ))}
        </select>
        <input value={form.transactionReference} onChange={(event) => updateForm("transactionReference", event.target.value)} placeholder="Reference number" />
        <input type="date" value={form.payoutDate} onChange={(event) => updateForm("payoutDate", event.target.value)} />
        <input type="number" min="0" step="0.01" value={form.gstDeduction} onChange={(event) => updateForm("gstDeduction", event.target.value)} placeholder="GST deduction" />
        <input type="number" min="0" step="0.01" value={form.tdsDeduction} onChange={(event) => updateForm("tdsDeduction", event.target.value)} placeholder="TDS deduction" />
        <select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
        </select>
        <textarea className="span-2" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Notes" />
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Process Payout"}</button>
      </form>

      <section className="payout-toolbar">
        <label className="payout-search span-2">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search recipient, reference, notes" />
        </label>
        <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
          <option value="pending">Pending amount</option>
          <option value="amount">Net amount</option>
          <option value="gross">Gross revenue</option>
          <option value="name">Recipient name</option>
        </select>
      </section>

      <section className="catalog-panel payout-table">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 7 }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
          </div>
        ) : data.payouts.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Artist / Label</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net Payable</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Payout Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((payout) => {
                  const rowId = payout.id || payout.queueId;

                  return (
                    <tr key={rowId}>
                      <td>
                        <input type="checkbox" checked={selected.includes(rowId)} onChange={() => toggleSelected(rowId)} />
                      </td>
                      <td>
                        <strong>{payout.recipientName}</strong>
                        <div>{payout.recipientType}</div>
                      </td>
                      <td>{formatCurrency(payout.grossAmount)}</td>
                      <td>{formatCurrency(payout.deductions)}</td>
                      <td>{formatCurrency(payout.pendingAmount || payout.netAmount)}</td>
                      <td><PayoutStatusBadge status={payout.status} /></td>
                      <td>{payout.paymentMethod || "-"}</td>
                      <td>{payout.transactionReference || "-"}</td>
                      <td>{payout.payoutDate ? formatDate(payout.payoutDate) : "-"}</td>
                      <td>
                        <div className="payout-actions-inline">
                          <Link to={`/payouts/${rowId}`}>View</Link>
                          {payout.status === "pending" ? <button type="button" onClick={() => fillFromRow(payout)}>Pay</button> : null}
                          {payout.id && payout.status === "processing" ? <button type="button" onClick={() => updateStatus(payout, "completed")}>Complete</button> : null}
                          {payout.id && ["pending", "processing"].includes(payout.status) ? <button type="button" onClick={() => updateStatus(payout, "failed")}>Fail</button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="payout-empty">No payout records found for the current filters.</div>
        )}
      </section>

      <div className="pagination-bar">
        <span>
          Page {data.pagination.page} of {data.pagination.totalPages} - {formatNumber(data.pagination.total)} rows
        </span>
        <div>
          <button className="secondary-button" type="button" disabled={filters.page <= 1} onClick={() => updateFilter("page", filters.page - 1)}>Previous</button>
          <button className="secondary-button" type="button" disabled={filters.page >= data.pagination.totalPages} onClick={() => updateFilter("page", filters.page + 1)}>Next</button>
        </div>
      </div>

      <ConfirmModal
        open={bulkOpen}
        title="Bulk process payouts?"
        message={`This will create processing payout records for ${selectedRows.length} selected pending rows.`}
        confirmLabel={saving ? "Processing..." : "Process"}
        onConfirm={bulkProcess}
        onCancel={() => setBulkOpen(false)}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default PayoutQueue;
