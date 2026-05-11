const LoadingSkeleton = ({ rows = 5 }) => (
  <div className="catalog-skeleton revenue-skeleton-wrap" aria-busy="true">
    {Array.from({ length: rows }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
  </div>
);

export default LoadingSkeleton;
