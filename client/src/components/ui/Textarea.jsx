const Textarea = ({ className = '', error, rows = 3, ...props }) => (
  <textarea
    rows={rows}
    className={`w-full rounded-md border bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed resize-y ${className}`}
    style={{
      borderColor: error ? 'var(--color-danger)' : 'var(--border-subtle)',
      boxShadow: error ? '0 0 0 3px color-mix(in srgb, var(--color-danger) 18%, transparent)' : undefined,
    }}
    {...props}
  />
);

export default Textarea;
