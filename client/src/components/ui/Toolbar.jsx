const Toolbar = ({ children, className = '' }) => (
  <div className={`flex flex-col sm:flex-row sm:items-center gap-3 mb-4 ${className}`}>
    {children}
  </div>
);

const FilterBar = ({ children, className = '' }) => (
  <div
    className={`flex flex-nowrap items-center gap-2 mb-4 p-2.5 sm:p-3 rounded-lg overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] ${className}`}
    style={{
      background: 'var(--surface-overlay)',
      border: '1px solid var(--border-subtle)',
    }}
  >
    {/* Force touch targets + no shrink on filter chips/inputs */}
    <div className="flex flex-nowrap items-center gap-2 min-h-[44px] [&>*]:shrink-0">
      {children}
    </div>
  </div>
);

export { FilterBar };
export default Toolbar;
