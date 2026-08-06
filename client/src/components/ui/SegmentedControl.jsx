const SegmentedControl = ({ value, onChange, options = [], className = '' }) => (
  <div
    className={`inline-flex p-1 rounded-lg gap-0.5 ${className}`}
    style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
    role="tablist"
  >
    {options.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange?.(opt.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
          style={{
            background: active ? 'var(--surface-raised)' : 'transparent',
            color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
            boxShadow: active ? 'var(--shadow-card)' : 'none',
          }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

export default SegmentedControl;
