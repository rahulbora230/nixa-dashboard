import { CheckCircle2, Clock3, Disc3, WalletCards } from "lucide-react";
import { formatCurrency, formatNumber } from "../../utils/formatters";

const roleMetrics = [
  { label: "Revenue", value: formatCurrency(428500), icon: WalletCards },
  { label: "Streams", value: formatNumber(1842000), icon: Disc3 },
  { label: "Live Releases", value: "28", icon: CheckCircle2 },
  { label: "Pending Items", value: "4", icon: Clock3 },
];

const RoleDashboardShell = ({ roleName }) => (
  <div className="page-stack">
    <section className="admin-hero compact-hero">
      <div>
        <p className="eyebrow">{roleName} Workspace</p>
        <h2>{roleName} dashboard foundation</h2>
        <p>The role-based shell is ready. Full {roleName.toLowerCase()} workflows come in Phase 2.</p>
      </div>
    </section>

    <section className="stats-grid four-columns">
      {roleMetrics.map((item) => {
        const Icon = item.icon;

        return (
          <article className="metric-card" key={item.label}>
            <div className="metric-icon">
              <Icon size={19} />
            </div>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>Workspace shell</small>
            </div>
          </article>
        );
      })}
    </section>
  </div>
);

export default RoleDashboardShell;
