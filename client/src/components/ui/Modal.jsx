import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

const WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const Modal = ({ open, onClose, title, subtitle, size = 'md', children, footer }) => (
  <Dialog.Root open={open} onOpenChange={(v) => !v && onClose?.()}>
    <Dialog.Portal>
      <Dialog.Overlay
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      />
      {/* Centrage via flex : l'animation scale ne doit pas écraser translate */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <Dialog.Content
          className={`pointer-events-auto w-full ${WIDTHS[size]} max-h-[min(85vh,calc(100%-2rem))] flex flex-col outline-none animate-modal-enter`}
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-modal)',
          }}
          aria-describedby={undefined}
        >
          <div
            className="flex shrink-0 items-start justify-between px-6 py-5"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div>
              {title && (
                <Dialog.Title
                  className="text-base font-semibold"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
                >
                  {title}
                </Dialog.Title>
              )}
              {subtitle && (
                <Dialog.Description className="mt-0.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  {subtitle}
                </Dialog.Description>
              )}
              {!subtitle && <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1 rounded-md transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">{children}</div>

          {footer && (
            <div
              className="flex shrink-0 items-center justify-end gap-3 px-6 py-4"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {footer}
            </div>
          )}
        </Dialog.Content>
      </div>
    </Dialog.Portal>
  </Dialog.Root>
);

export default Modal;
