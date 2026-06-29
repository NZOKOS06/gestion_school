import { useEffect, useRef } from 'react';
import { Bell, Package, Clock, FileText, ShoppingCart, MapPin, X, CheckCheck, Trash2 } from 'lucide-react';

const NOTIF_COLORS = {
  stock:      { bg: 'bg-red-50',    icon: 'text-red-500',    border: '#f87171'    },
  peremption: { bg: 'bg-orange-50', icon: 'text-orange-500', border: '#fb923c' },
  ordonnance: { bg: 'bg-blue-50',   icon: 'text-blue-500',   border: '#60a5fa'   },
  vente:      { bg: 'bg-green-50',  icon: 'text-green-500',  border: '#4ade80'  },
  livraison:  { bg: 'bg-blue-50',   icon: 'text-blue-500',   border: '#60a5fa'   },
};

const NOTIF_ICONS = {
  Package,
  Clock,
  FileText,
  ShoppingCart,
  MapPin,
};

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function NotificationsPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onClear,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 380,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 520,
        background: '#ffffff',
        border: '1px solid #E2E8F0',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'notifFadeDown 200ms ease forwards',
      }}
    >
      <style>{`
        @keyframes notifFadeDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                background: '#ef4444',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 10,
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              title="Tout marquer comme lu"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                background: 'none',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                color: '#64748B',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <CheckCheck size={13} />
              Tout lire
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={onClear}
              title="Vider les notifications"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                background: 'none',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                color: '#ef4444',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <Trash2 size={13} />
              Vider
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 16px',
              gap: 10,
            }}
          >
            <Bell size={48} color="#CBD5E1" />
            <span style={{ fontSize: 14, color: '#94A3B8' }}>Aucune notification</span>
          </div>
        ) : (
          notifications.map((notif) => {
            const colors = NOTIF_COLORS[notif.type] || NOTIF_COLORS.ordonnance;
            const IconComp = NOTIF_ICONS[notif.icon] || Bell;

            return (
              <div
                key={notif.id}
                onClick={() => onMarkRead(notif.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: '1px solid #F1F5F9',
                  borderLeft: notif.read ? '3px solid transparent' : `3px solid ${colors.border}`,
                  background: notif.read ? 'transparent' : '#FAFBFF',
                  opacity: notif.read ? 0.6 : 1,
                  cursor: 'pointer',
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = notif.read ? 'transparent' : '#FAFBFF';
                }}
              >
                {/* Icon circle */}
                <div
                  className={colors.bg}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconComp size={15} className={colors.icon} />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#0F172A',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {notif.title}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      margin: '2px 0 0',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {notif.message}
                  </p>
                </div>

                {/* Time */}
                <span
                  style={{
                    fontSize: 11,
                    color: '#94A3B8',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    paddingTop: 1,
                  }}
                >
                  {timeAgo(notif.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #F1F5F9',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            {notifications.length} notification{notifications.length > 1 ? 's' : ''} au total
          </span>
        </div>
      )}
    </div>
  );
}

export default NotificationsPanel;
