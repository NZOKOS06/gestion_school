const COLOR_VARS = {
  primary: 'var(--color-primary)',
  green: 'var(--color-success)',
  red: 'var(--color-danger)',
  orange: 'var(--color-warning)',
  blue: 'var(--color-info)',
};

const KpiCard = ({ label, value, subtitle, icon: Icon, trend, color = 'primary', delay = 0, 'data-testid': testId, className = '', ...rest }) => {
  const accent = COLOR_VARS[color] || COLOR_VARS.primary;
  const hausse = trend > 0;
  const trendColor = hausse ? 'var(--color-success)' : 'var(--color-danger)';

  return (
    <div
      className={`fade-up card-hover rounded-xl p-3.5 sm:p-5 transition-all h-full min-w-0 ${className}`}
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        animationDelay: `${delay}ms`,
      }}
      {...rest}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-2 sm:mb-3 truncate"
            style={{ color: 'var(--text-muted)' }}
            title={label}
          >
            {label}
          </p>
          <p
            data-testid={testId}
            className="mono truncate"
            style={{
              fontSize: 'clamp(1.25rem, 4.5vw, 1.875rem)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.1,
            }}
            title={String(value)}
          >
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs line-clamp-2" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--surface-brand-soft)' }}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: accent }} />
          </div>
        )}
      </div>

      {trend != null && (
        <div className="mt-3 sm:mt-4 flex items-center gap-2 flex-wrap">
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
