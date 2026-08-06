const Input = ({
  className = '',
  error,
  size = 'md',
  ...props
}) => {
  const sizes = {
    sm: 'h-8 px-2.5 text-xs',
    md: 'h-9 px-3 text-sm',
    lg: 'h-11 px-3.5 text-base',
  };

  return (
    <input
      className={`w-full rounded-md border bg-[var(--surface-raised)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${className}`}
      style={{
        borderColor: error ? 'var(--color-danger)' : 'var(--border-subtle)',
        boxShadow: error ? '0 0 0 3px color-mix(in srgb, var(--color-danger) 18%, transparent)' : undefined,
      }}
      {...props}
    />
  );
};

export default Input;
