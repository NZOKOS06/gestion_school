const PageHeader = ({ title, subtitle, actions, 'data-testid': testId }) => {
  return (
    <div
      data-testid={testId}
      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 mb-8"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div>
        {title && (
          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};

export default PageHeader;
