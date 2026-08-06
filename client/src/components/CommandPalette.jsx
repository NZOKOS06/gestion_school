import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, CornerDownLeft } from 'lucide-react';

const CommandPalette = ({ open, onClose, pages = [] }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages.slice(0, 12);
    return pages
      .filter(
        (p) =>
          p.label?.toLowerCase().includes(q) ||
          p.path?.toLowerCase().includes(q) ||
          p.group?.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, pages]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const go = (page) => {
    if (!page) return;
    onClose?.();
    navigate(page.path);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose?.()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[60]"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
        />
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4 pointer-events-none">
          <Dialog.Content
            className="pointer-events-auto w-full max-w-lg outline-none animate-modal-enter overflow-hidden"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-modal)',
            }}
            onKeyDown={onKeyDown}
            aria-describedby={undefined}
          >
          <Dialog.Title className="sr-only">Recherche rapide</Dialog.Title>
          <Dialog.Description className="sr-only">Naviguer vers une page de l&apos;application</Dialog.Description>

          <div
            className="flex items-center gap-3 px-4"
            style={{ borderBottom: '1px solid var(--border-subtle)', height: 52 }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Aller à… élèves, paiements, bulletins…"
              className="flex-1 bg-transparent border-0 outline-none text-sm"
              style={{ color: 'var(--text-primary)', boxShadow: 'none' }}
            />
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
            >
              Esc
            </kbd>
          </div>

          <ul className="max-h-80 overflow-y-auto py-2">
            {results.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Aucun résultat
              </li>
            ) : (
              results.map((page, i) => {
                const Icon = page.icon;
                const isActive = i === active;
                return (
                  <li key={page.path}>
                    <button
                      type="button"
                      onClick={() => go(page)}
                      onMouseEnter={() => setActive(i)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                      style={{
                        background: isActive ? 'var(--surface-brand-soft)' : 'transparent',
                        color: isActive ? 'var(--color-primary)' : 'var(--text-primary)',
                      }}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" />}
                      <span className="flex-1 truncate font-medium">{page.label}</span>
                      {page.group && (
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {page.group}
                        </span>
                      )}
                      {isActive && <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CommandPalette;
