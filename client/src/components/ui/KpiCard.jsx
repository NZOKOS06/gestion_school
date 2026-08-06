const COLOR_VARS = {
  primary: 'var(--color-primary)',
  green: 'var(--color-success)',
  red: 'var(--color-danger)',
  orange: 'var(--color-warning)',
  blue: 'var(--color-info)',
};

const KpiCard = ({ label, value, subtitle, icon: Icon, trend, color = 'primary', delay = 0, 'data-testid': testId, ...rest }) => {
  const accent = COLOR_VARS[color] || COLOR_VARS.primary;
  const hausse = trend > 0;
  const trendColor = hausse ? 'var(--color-success)' : 'var(--color-danger)';

  return (
    <div
      className="fade-up card-hover rounded-xl p-5 transition-all"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        animationDelay: `${delay}ms`,
      }}
      {...rest}
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
            className="mono"
            style={{
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
            style={{ background: 'var(--surface-brand-soft)' }}
          >
            <Icon className="h-5 w-5" style={{ color: accent }} />
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
