import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

const Chart = ({ data }) => {
  return (
    <LineChart width={700} height={300} data={data}>
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip />
      <CartesianGrid stroke="#333" />
      <Line type="monotone" dataKey="earnings" stroke="#00FFAA" />
    </LineChart>
  );
};

export default Chart;