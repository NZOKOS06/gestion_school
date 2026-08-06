import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import PageTransition from '../transitions/PageTransition';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarX,
  Gavel,
  Wallet,
  LogOut,
  Menu,
  GraduationCap,
  ChevronRight,
  Bell,
  Mail,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationsPanel } from '../NotificationsPanel';
import { ThemeToggle } from '../ui';
import { useI18n } from '../../contexts/I18nContext';

const SIDEBAR_WIDTH = 240;

const NAV_ITEMS = [
  {
    groupKey: 'espace_parent',
    items: [
      { path: '/parent/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
      { path: '/parent/mes-enfants', icon: Users, labelKey: 'mes_enfants' },
      { path: '/parent/bulletins', icon: FileText, labelKey: 'bulletins' },
      { path: '/parent/absences', icon: CalendarX, labelKey: 'absences' },
      { path: '/parent/sanctions', icon: Gavel, labelKey: 'sanctions' },
      { path: '/parent/facturation', icon: Wallet, labelKey: 'facturation' },
      { path: '/parent/messagerie', icon: Mail, labelKey: 'messagerie' },
    ],
  },
];

function filArianeDepuisChemin(pathname) {
  const map = {
    dashboard: 'Tableau de bord',
    'mes-enfants': 'Mes enfants',
    bulletins: 'Bulletins',
    absences: 'Absences',
    sanctions: 'Sanctions',
    facturation: 'Facturation',
    messagerie: 'Messagerie',
  };
  const segments = pathname.replace('/parent/', '').split('/');
  return [
    { label: 'Parent', path: '/parent/dashboard' },
    { label: map[segments[0]] || segments[0] },
  ];
}

const ParentLayout = () => {
  const { user, logout } = useAuth();
  const { config } = useTenant();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, markRead, clear } = useNotifications();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = useMemo(() => NAV_ITEMS.map((g) => ({
    label: t(g.groupKey),
    items: g.items.map((item) => ({ ...item, label: t(item.labelKey) })),
  })), [t]);
  const ariane = filArianeDepuisChemin(pathname);
  const nomApp = config?.nomApp || 'GestSchool';

  const navItemClass = (isActive) =>
    [
      'flex items-center gap-2.5 px-3 h-9 rounded-md text-sm font-medium transition-all',
      'relative overflow-hidden',
      isActive
        ? 'text-[var(--color-primary)]'
        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
    ].join(' ');

  const activeIndicator = (
    <span
      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full"
      style={{ backgroundColor: 'var(--color-primary)' }}
    />
  );

  const sidebarContent = (
    <div className="h-full flex flex-col">
      <div
        className="shrink-0 border-b flex items-center gap-2.5 px-4"
        style={{ borderColor: 'var(--border-subtle)', height: 56 }}
      >
        {config?.logoUrl ? (
          <img src={config.logoUrl} alt={nomApp} className="h-7 w-auto" />
        ) : (
          <GraduationCap className="h-5 w-5 shrink-0" style={{ color: 'var(--color-primary)' }} />
        )}
        <span className="text-sm font-semibold tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>
          {nomApp}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
        {menuItems.map((groupe) => (
          <div key={groupe.label}>
            <span
              className="block px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              {groupe.label}
            </span>
            <div className="space-y-0.5">
              {groupe.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => navItemClass(isActive)}
                  style={({ isActive }) =>
                    isActive
                      ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }
                      : {}
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && activeIndicator}
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t p-3 space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 px-1">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{
              background: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
              color: 'var(--color-primary)',
            }}
          >
            {user?.prenom?.[0]}
            {user?.nom?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {user?.prenom} {user?.nom}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              Parent
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--text-secondary)' }}
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div data-theme="admin" className="min-h-screen flex" style={{ background: 'var(--surface-base)' }}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className="fixed lg:fixed inset-y-0 left-0 z-50 hidden lg:flex flex-col"
        style={{
          width: SIDEBAR_WIDTH,
          background: 'var(--surface-raised)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        {sidebarContent}
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col lg:hidden transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: SIDEBAR_WIDTH,
          background: 'var(--surface-raised)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        {sidebarContent}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col lg:ml-[240px]">
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-6"
          style={{
            height: 56,
            background: 'var(--surface-base)',
            borderBottom: '1px solid var(--border-subtle)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-md transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav className="flex items-center gap-1 text-sm">
              {ariane.map((crumb, i) => (
                <span key={crumb.label} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />}
                  {crumb.path ? (
                    <NavLink to={crumb.path} className="hover:underline" style={{ color: 'var(--text-secondary)' }}>
                      {crumb.label}
                    </NavLink>
                  ) : (
                    <span style={{ color: 'var(--text-primary)' }} className="font-medium">
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>

            <ThemeToggle />

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)', background: 'var(--surface-hover)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-active)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <NotificationsPanel
                  open={notifOpen}
                  onClose={() => setNotifOpen(false)}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkAllRead={() => { markAllRead(); }}
                  onMarkRead={markRead}
                  onClear={clear}
                />
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxWidth: 1400 }}>
          <PageTransition />
        </main>
      </div>
    </div>
  );
};

export default ParentLayout;
