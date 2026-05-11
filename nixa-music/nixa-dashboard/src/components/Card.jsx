const Card = ({ title, value }) => {
  return (
    <div style={{
      background: '#161C23',
      padding: 20,
      borderRadius: 12,
      minWidth: 200
    }}>
      <p style={{ color: '#888' }}>{title}</p>
      <h2>₹ {value}</h2>
    </div>
  );
};

export default Card;