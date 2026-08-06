const Toolbar = ({ children, className = '' }) => (
  <div className={`flex flex-col sm:flex-row sm:items-center gap-3 mb-4 ${className}`}>
    {children}
  </div>
);

const FilterBar = ({ children, className = '' }) => (
  <div
    className={`flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg ${className}`}
    style={{
      background: 'var(--surface-overlay)',
      border: '1px solid var(--border-subtle)',
    }}
  >
    {children}
  </div>
);

export { FilterBar };
export default Toolbar;
