import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

const WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Desktop: centered dialog. Mobile: bottom sheet.
 */
const Modal = ({ open, onClose, title, subtitle, size = 'md', children, footer }) => (
  <Dialog.Root open={open} onOpenChange={(v) => !v && onClose?.()}>
    <Dialog.Portal>
      <Dialog.Overlay
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      />
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
      >
        <Dialog.Content
          className={`pointer-events-auto w-full ${WIDTHS[size]} flex flex-col outline-none
            max-h-[92dvh] sm:max-h-[min(85vh,calc(100%-2rem))]
            rounded-t-2xl sm:rounded-[var(--radius-xl)]
            animate-modal-enter`}
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-modal)',
          }}
          aria-describedby={undefined}
        >
          {/* Mobile sheet handle */}
          <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0" aria-hidden>
            <span
              className="h-1 w-10 rounded-full"
              style={{ background: 'var(--border-default)' }}
            />
          </div>

          <div
            className="flex shrink-0 items-start justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div className="min-w-0">
              {title && (
                <Dialog.Title
                  className="text-base font-semibold truncate"
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
                className="p-2 rounded-md transition-colors hover:bg-[var(--surface-hover)] min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 overscroll-contain">
            {children}
          </div>

          {footer && (
            <div
              className="flex shrink-0 flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
              }}
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
