import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatNumber } from "../../utils/formatters";

const tooltipStyle = {
  background: "#07111d",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#fff",
};

const RevenueTrendChart = ({ data = [] }) => (
  <ResponsiveContainer width="100%" height={310}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id="grossRevenueGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#10d7ff" stopOpacity={0.55} />
          <stop offset="95%" stopColor="#10d7ff" stopOpacity={0.02} />
        </linearGradient>
        <linearGradient id="artistShareGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#f43f9a" stopOpacity={0.35} />
          <stop offset="95%" stopColor="#f43f9a" stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
      <XAxis dataKey="month" stroke="#8392a7" tickLine={false} axisLine={false} />
      <YAxis stroke="#8392a7" tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} />
      <Tooltip
        contentStyle={tooltipStyle}
        formatter={(value, name) => [name === "streams" ? formatNumber(value) : formatCompactCurrency(value), name]}
      />
      <Area
        type="monotone"
        dataKey="grossRevenue"
        name="Gross revenue"
        stroke="#10d7ff"
        strokeWidth={3}
        fill="url(#grossRevenueGlow)"
      />
      <Area
        type="monotone"
        dataKey="artistShare"
        name="Artist share"
        stroke="#f43f9a"
        strokeWidth={2}
        fill="url(#artistShareGlow)"
      />
    </AreaChart>
  </ResponsiveContainer>
);

export default RevenueTrendChart;
