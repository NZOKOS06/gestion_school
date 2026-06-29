import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const Modal = ({ open, onClose, title, subtitle, size = 'md', children, footer }) => {
  useEffect(() => {
    const onEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (open) {
      document.addEventListener('keydown', onEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      />

      <div
        className={`relative w-full ${WIDTHS[size]} max-h-[90vh] flex flex-col mt-10 mb-4 animate-modal-enter`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-start justify-between px-6 py-5"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div>
            {title && (
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-6 py-5"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border-default) transparent',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex shrink-0 items-center justify-end gap-3 px-6 py-4"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
