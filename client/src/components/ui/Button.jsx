const Spinner = ({ className = 'h-4 w-4' }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const SIZES = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
};

const VARIANTS = {
  primary:
    'bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:brightness-110 active:scale-[0.98]',
  secondary:
    'bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-subtle)]',
  danger:
    'border text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
};

const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  disabled,
  onClick,
  children,
  className = '',
  type = 'button',
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all select-none';
  const disabledState = 'disabled:opacity-50 disabled:cursor-not-allowed';
  const loadingState = loading ? 'opacity-80 cursor-wait' : '';

  const isDanger = variant === 'danger';
  const dangerBorder = isDanger
    ? { borderColor: 'color-mix(in srgb, var(--color-danger) 40%, transparent)' }
    : {};
  const dangerBg = isDanger
    ? { backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)' }
    : {};

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${disabledState} ${loadingState} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      style={{
        fontFamily: 'var(--font-sans)',
        letterSpacing: '-0.01em',
        transition: 'var(--transition-fast)',
        ...dangerBorder,
        ...dangerBg,
      }}
      {...props}
    >
      {loading && <Spinner className={children ? 'h-4 w-4' : 'h-5 w-5'} />}
      {!loading && Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children && <span className={loading ? 'opacity-50' : ''}>{children}</span>}
    </button>
  );
};

export default Button;
