const FieldError = ({ children }) => {
  if (!children) return null;
  return (
    <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
      {children}
    </p>
  );
};

const FormField = ({ label, htmlFor, required, error, hint, children, className = '' }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && (
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
        {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </label>
    )}
    {children}
    {hint && !error && (
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{hint}</p>
    )}
    <FieldError>{error}</FieldError>
  </div>
);

export { FieldError };
export default FormField;
