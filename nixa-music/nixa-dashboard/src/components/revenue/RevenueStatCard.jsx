import { ArrowUpRight } from "lucide-react";

const RevenueStatCard = ({ icon: Icon, title, value, caption, tone = "cyan" }) => (
  <article className={`metric-card revenue-stat-card tone-${tone}`}>
    <div className="metric-icon">
      <Icon size={19} />
    </div>
    <div>
      <span>{title}</span>
      <strong>{value}</strong>
      {caption ? (
        <small>
          <ArrowUpRight size={13} />
          {caption}
        </small>
      ) : null}
    </div>
  </article>
);

export default RevenueStatCard;
