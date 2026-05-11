const StatCard = ({ title, value, caption, tone = "cyan", icon: Icon }) => (
  <article className={`metric-card ${tone}-card`}>
    <span>{title}</span>
    <strong>{value}</strong>
    <p>{caption}</p>
    {Icon && <Icon size={20} aria-hidden="true" />}
  </article>
);

export default StatCard;
