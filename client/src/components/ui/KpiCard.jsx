const PALETTES = {
  primary: { color: '#16a34a' },
  green:   { color: '#10B981' },
  red:     { color: '#dc2626' },
  orange:  { color: '#d97706' },
  blue:    { color: '#2563eb' },
};

const KpiCard = ({ label, value, subtitle, icon: Icon, trend, color = 'primary', delay = 0, 'data-testid': testId, ...rest }) => {
  const palette = PALETTES[color] || PALETTES.primary;
  const hausse = trend > 0;
  const trendColor = hausse ? '#16a34a' : '#dc2626';

  return (
    <div
      className="fade-up rounded-xl p-5 transition-all"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        animationDelay: `${delay}ms`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            {label}
          </p>
          <p
            data-testid={testId}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 30,
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.1,
            }}
          >
            {value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ml-4"
            style={{
              background: `color-mix(in srgb, ${palette.color} 12%, transparent)`,
            }}
          >
            <Icon className="h-5 w-5" style={{ color: palette.color }} />
          </div>
        )}
      </div>

      {trend != null && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{
              background: `color-mix(in srgb, ${trendColor} 12%, transparent)`,
              color: trendColor,
            }}
          >
            {hausse ? '↑' : '↓'} {hausse ? '+' : ''}{trend}%
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            vs période précédente
          </span>
        </div>
      )}
    </div>
  );
};

export default KpiCard;
