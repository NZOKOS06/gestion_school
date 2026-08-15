import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Recherche rapide + sélection d'une entité (élève, staff, etc.)
 */
const QuickSearchSelect = ({
  items = [],
  value = '',
  onChange,
  getOptionLabel = (item) => `${item.prenom || ''} ${item.nom || ''}`.trim(),
  getOptionKey = (item) => item.id,
  placeholder = 'Rechercher…',
  emptyLabel = 'Aucun résultat',
  disabled = false,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected = useMemo(
    () => items.find((item) => getOptionKey(item) === value) || null,
    [items, value, getOptionKey]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 40);
    return items
      .filter((item) => getOptionLabel(item).toLowerCase().includes(q))
      .slice(0, 40);
  }, [items, query, getOptionLabel]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const inputStyle = {
    width: '100%',
    height: 38,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 36px 0 36px',
  };

  if (selected && !open) {
    return (
      <div
        className="flex items-center justify-between gap-2 px-3 rounded-md"
        style={{
          height: 38,
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {getOptionLabel(selected)}
        </span>
        {!disabled && (
          <button
            type="button"
            className="p-1 rounded hover:bg-[var(--surface-hover)] shrink-0"
            onClick={() => onChange('')}
            title="Effacer"
          >
            <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
        style={{ color: 'var(--text-muted)' }}
      />
      <input
        type="text"
        style={inputStyle}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div
          className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md shadow-lg"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>{emptyLabel}</p>
          ) : (
            filtered.map((item) => {
              const key = getOptionKey(item);
              return (
                <button
                  key={key}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text-primary)' }}
                  onClick={() => {
                    onChange(key);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  {getOptionLabel(item)}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default QuickSearchSelect;
