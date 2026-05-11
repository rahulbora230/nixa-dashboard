const PayoutStatusBadge = ({ status = "pending" }) => (
  <span className={`payout-status payout-status-${status}`}>{status}</span>
);

export default PayoutStatusBadge;
