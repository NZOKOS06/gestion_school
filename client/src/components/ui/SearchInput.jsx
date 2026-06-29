import { Search, Loader2 } from 'lucide-react';

const SearchInput = ({ value, onChange, placeholder = 'Rechercher...', loading = false, ...rest }) => {
  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
        style={{ color: 'var(--text-muted)' }}
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...rest}
        className="w-full pl-9 pr-10 text-sm transition-all"
        style={{
          height: 36,
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--color-primary)';
          e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border-subtle)';
          e.target.style.boxShadow = 'none';
        }}
      />
      {loading && (
        <Loader2
          className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin"
          style={{ color: 'var(--text-muted)' }}
        />
      )}
    </div>
  );
};

export default SearchInput;
