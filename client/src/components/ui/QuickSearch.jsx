import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import Checkbox from './Checkbox';

const defaultLabel = (item) => {
  if (!item) return '';
  if (item.label) return item.label;
  const name = `${item.prenom || ''} ${item.nom || ''}`.trim();
  if (item.matricule) return `${name} (${item.matricule})`;
  if (item.role) return `${name} (${item.role})`;
  if (item.email) return `${name} — ${item.email}`;
  return name || item.nom || String(item.id || '');
};

/**
 * Recherche rapide + sélection d'un élément (remplace les <select> longs).
 */
export const QuickSearchSelect = ({
  items = [],
  value = '',
  onChange,
  getLabel = defaultLabel,
  getSearchText,
  placeholder = 'Rechercher…',
  disabled = false,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const searchFn = getSearchText || getLabel;

  const selected = useMemo(
    () => items.find((i) => i.id === value) || null,
    [items, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 40);
    return items
      .filter((item) => searchFn(item).toLowerCase().includes(q))
      .slice(0, 40);
  }, [items, query, searchFn]);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
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
          {getLabel(selected)}
        </span>
        {!disabled && (
          <button
            type="button"
            className="p-1 rounded hover:bg-[var(--surface-hover)]"
            onClick={() => onChange?.('')}
            title="Effacer"
          >
            <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
        style={{ color: 'var(--text-muted)' }}
      />
      <input
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
          className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-md shadow-lg"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>Aucun résultat</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-primary)' }}
                onClick={() => {
                  onChange?.(item.id, item);
                  setQuery('');
                  setOpen(false);
                }}
              >
                {getLabel(item)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Liste cochable avec champ de recherche (participants, etc.).
 */
export const QuickSearchChecklist = ({
  items = [],
  values = [],
  onChange,
  getLabel = defaultLabel,
  getSearchText,
  placeholder = 'Rechercher…',
  maxHeight = 180,
}) => {
  const [query, setQuery] = useState('');
  const searchFn = getSearchText || getLabel;
  const selectedSet = useMemo(() => new Set(values), [values]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => searchFn(item).toLowerCase().includes(q));
  }, [items, query, searchFn]);

  const toggle = (id) => {
    const next = selectedSet.has(id)
      ? values.filter((v) => v !== id)
      : [...values, id];
    onChange?.(next);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm"
          style={{
            height: 36,
            paddingLeft: 36,
            paddingRight: 12,
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
          }}
        />
      </div>
      <div
        className="rounded-md overflow-y-auto space-y-1 p-2"
        style={{
          maxHeight,
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {filtered.length === 0 ? (
          <p className="text-sm px-1 py-2" style={{ color: 'var(--text-muted)' }}>Aucun résultat</p>
        ) : (
          filtered.map((item) => (
            <Checkbox
              key={item.id}
              id={`qs-${item.id}`}
              checked={selectedSet.has(item.id)}
              onCheckedChange={() => toggle(item.id)}
              label={getLabel(item)}
              className="w-full py-1 px-1 rounded hover:bg-[var(--surface-hover)]"
            />
          ))
        )}
      </div>
      {values.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {values.length} sélectionné{values.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

export default QuickSearchSelect;
