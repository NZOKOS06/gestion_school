const VARIANT_VARS = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  primary: 'var(--color-primary)',
  neutral: null,
};

const Badge = ({ variant = 'neutral', children, dot = false }) => {
  const color = VARIANT_VARS[variant];

  const style =
    variant === 'neutral'
      ? {
          background: 'var(--surface-hover)',
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-subtle)',
        }
      : {
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          color,
          borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-medium border"
      style={{
        height: 22,
        padding: '0 10px',
        fontSize: 11,
        ...style,
      }}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: color || 'var(--text-muted)' }}
          />
          <span
            className="relative inline-flex rounded-full h-full w-full"
            style={{ backgroundColor: color || 'var(--text-muted)' }}
          />
        </span>
      )}
      {children}
    </span>
  );
};

export default Badge;
