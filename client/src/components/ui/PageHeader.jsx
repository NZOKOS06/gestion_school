const PageHeader = ({ title, subtitle, actions, 'data-testid': testId }) => {
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 pb-4 sm:pb-6 mb-5 sm:mb-8"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="min-w-0">
        {title && (
          <h1
            className="text-[20px] sm:text-[22px] font-semibold tracking-tight"
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
      {actions && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
