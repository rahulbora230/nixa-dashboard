const StatusBadge = ({ status = "active", children }) => (
  <span className={`status-badge status-${String(status).toLowerCase()}`}>{children || status}</span>
);

export default StatusBadge;
