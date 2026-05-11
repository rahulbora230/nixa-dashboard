const BrandMark = ({ compact = false }) => (
  <div className={compact ? "brand-mark compact" : "brand-mark"}>
    <img src="/favicon.svg" alt="Nixa Music" />
    {!compact && (
      <div>
        <strong>Nixa Music</strong>
        <span>Distribution OS</span>
      </div>
    )}
  </div>
);

export default BrandMark;
