import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCompactCurrency, formatNumber } from "../../utils/formatters";

const colors = ["#10d7ff", "#a855f7", "#f43f9a", "#5eead4", "#3b82f6", "#fbbf24", "#fb7185", "#38bdf8"];

const PlatformBreakdownChart = ({ data = [] }) => {
  const chartData = data.map((item, index) => ({
    ...item,
    value: item.grossRevenue,
    color: colors[index % colors.length],
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie data={chartData} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={4}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#07111d",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "#fff",
            }}
            formatter={(value) => formatCompactCurrency(value)}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="platform-list">
        {chartData.map((platform) => (
          <div key={platform.name}>
            <span style={{ "--platform-color": platform.color }} />
            <p>{platform.name}</p>
            <strong>{formatNumber(platform.streams)}</strong>
          </div>
        ))}
      </div>
    </>
  );
};

export default PlatformBreakdownChart;
