const statusLabels = {
  imported: "Imported",
  partial: "Partial",
  failed: "Failed",
  processing: "Processing",
  unpaid: "Unpaid",
  paid: "Paid",
};

const RevenueStatusBadge = ({ status = "processing" }) => {
  const normalized = String(status || "processing").toLowerCase();

  return <span className={`revenue-status-badge revenue-status-${normalized}`}>{statusLabels[normalized] || status}</span>;
};

export default RevenueStatusBadge;
