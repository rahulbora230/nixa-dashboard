const StatusBadge = ({ status }) => {
  const normalizedStatus = status || "draft";

  return <span className={`status-badge status-${normalizedStatus}`}>{normalizedStatus.replace(/_/g, " ")}</span>;
};

export default StatusBadge;
