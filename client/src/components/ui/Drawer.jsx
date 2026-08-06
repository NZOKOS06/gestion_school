import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

const Drawer = ({ open, onClose, title, children, side = 'left', width = 280 }) => (
  <Dialog.Root open={open} onOpenChange={(v) => !v && onClose?.()}>
    <Dialog.Portal>
      <Dialog.Overlay
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      />
      <Dialog.Content
        className={`fixed z-50 top-0 bottom-0 outline-none flex flex-col ${side === 'right' ? 'right-0 animate-slide-in' : 'left-0'}`}
        style={{
          width,
          maxWidth: '85vw',
          background: 'var(--surface-raised)',
          borderRight: side === 'left' ? '1px solid var(--border-subtle)' : undefined,
          borderLeft: side === 'right' ? '1px solid var(--border-subtle)' : undefined,
          animation: side === 'left' ? 'slideInLeft 0.25s ease-out' : undefined,
        }}
      >
        {(title || onClose) && (
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <Dialog.Title className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export default Drawer;
