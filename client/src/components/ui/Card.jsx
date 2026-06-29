const Card = ({ title, subtitle, icon: Icon, children, action, padding = 'p-6' }) => {
  return (
    <div
      className={`rounded-lg ${padding}`}
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {(title || action) && (
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className="h-9 w-9 rounded-md flex items-center justify-center"
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                }}
              >
                <Icon className="h-[18px] w-[18px]" style={{ color: 'var(--color-primary)' }} />
              </div>
            )}
            <div>
              {title && (
                <h3
                  className="text-base font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
