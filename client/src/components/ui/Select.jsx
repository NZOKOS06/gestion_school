const Select = ({ className = '', error, children, size = 'md', fullWidth = true, style, ...props }) => {
  const sizes = {
    sm: 'h-8 px-2.5 text-xs',
    md: 'h-9 px-3 text-sm',
    lg: 'h-11 px-3.5 text-base',
  };

  return (
    <select
      className={`${fullWidth ? 'w-full' : 'w-auto shrink-0'} rounded-md border bg-[var(--surface-raised)] text-[var(--text-primary)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${className}`}
      style={{
        borderColor: error ? 'var(--color-danger)' : 'var(--border-subtle)',
        boxShadow: error ? '0 0 0 3px color-mix(in srgb, var(--color-danger) 18%, transparent)' : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
};

export default Select;
