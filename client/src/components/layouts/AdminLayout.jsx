import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import PageTransition from '../transitions/PageTransition';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import {
  LayoutDashboard,
  Package,
  Pill,
  Truck,
  ShoppingCart,
  FileText,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Layers,
  FileCheck,
  Bell,
  User,
  KeyRound,
} from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationsPanel } from '../NotificationsPanel';
import { ThemeToggle } from '../ui';
import { useI18n } from '../../contexts/I18nContext';

const SIDEBAR_WIDTH = 256;

const ROUTE_LABELS = {
  '/admin/dashboard': 'Tableau de bord',
  '/admin/catalogue': 'Catalogue',
  '/admin/stock': 'Stock',
  '/admin/lots': 'Lots & Péremptions',
  '/admin/fournisseurs': 'Fournisseurs',
  '/admin/commandes-fournisseurs': 'Commandes fournisseurs',
  '/admin/factures': 'Factures',
  '/admin/ordonnances': 'Ordonnances',
  '/admin/ventes': 'Ventes',
  '/admin/livraisons': 'Livraisons',
  '/admin/personnel': 'Personnel',
  '/admin/rapports': 'Rapports',
  '/admin/configuration': 'Configuration',
};

const NAV_ITEMS = [
  {
    groupKey: 'operations',
    items: [
      { path: '/admin/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
      { path: '/admin/ventes', icon: ShoppingCart, labelKey: 'ventes', module: 'ventes' },
      { path: '/admin/ordonnances', icon: FileText, labelKey: 'ordonnances', module: 'ordonnances' },
      { path: '/admin/livraisons', icon: Truck, labelKey: 'livraisons', module: 'livraison' },
    ],
  },
  {
    groupKey: 'gestion',
    items: [
      { path: '/admin/catalogue', icon: Pill, labelKey: 'catalogue', module: 'catalogue' },
      { path: '/admin/stock', icon: Package, labelKey: 'stock', module: 'stock' },
      { path: '/admin/lots', icon: Layers, labelKey: 'lots', module: 'stock' },
      { path: '/admin/fournisseurs', icon: Truck, labelKey: 'fournisseurs', module: 'fournisseurs' },
      { path: '/admin/commandes-fournisseurs', icon: ShoppingCart, labelKey: 'commandes_fournisseurs', module: 'fournisseurs' },
      { path: '/admin/factures', icon: FileCheck, labelKey: 'factures', module: 'fournisseurs' },
      { path: '/admin/personnel', icon: Users, labelKey: 'personnel', module: 'personnel' },
    ],
  },
  {
    groupKey: 'analyse',
    items: [
      { path: '/admin/rapports', icon: BarChart3, labelKey: 'rapports', module: 'rapports' },
    ],
  },
  {
    groupKey: 'systeme',
    items: [
      { path: '/admin/configuration', icon: Settings, labelKey: 'configuration', superAdminOnly: true },
    ],
  },
];

function filArianeDepuisChemin(pathname) {
  const pageLabel = ROUTE_LABELS[pathname];
  if (!pageLabel) {
    const segments = pathname.replace('/admin/', '').split('/');
    return [
      { label: 'GestPharma', path: '/admin/dashboard' },
      { label: segments[0] || 'Page', isPrimary: true },
    ];
  }
  if (pathname === '/admin/dashboard') {
    return [{ label: 'GestPharma', path: '/admin/dashboard' }, { label: pageLabel, isPrimary: true }];
  }
  return [
    { label: 'GestPharma', path: '/admin/dashboard' },
    { label: pageLabel, isPrimary: true },
  ];
}

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { config, isModuleActive } = useTenant();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);
  const { notifications, unreadCount, markAllRead, markRead, clear } = useNotifications();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = useMemo(() => {
    return NAV_ITEMS.map((g) => ({
      label: t(g.groupKey),
      items: g.items
        .filter((item) => {
          if (item.module && !isModuleActive(item.module)) return false;
          if (item.superAdminOnly && user?.role !== 'super_admin') return false;
          return true;
        })
        .map((item) => ({ ...item, label: t(item.labelKey) })),
    })).filter((g) => g.items.length > 0);
  }, [isModuleActive, user?.role, t]);

  const ariane = filArianeDepuisChemin(pathname);
  const nomApp = config?.nomApp || 'GestPharma';

  const initials = `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`;
  const roleLabel = user?.role === 'pharmacien' ? 'Pharmacien' : 'Admin';

  const sidebarContent = (
    <div className="h-full flex flex-col" style={{ background: 'var(--surface-raised)' }}>
      {/* Logo zone */}
      <div
        className="shrink-0 flex items-center gap-3 px-5"
        style={{
          height: 64,
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-raised)',
        }}
      >
        {config?.logoUrl ? (
          <img src={config.logoUrl} alt={nomApp} className="h-8 w-auto" />
        ) : (
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-primary)' }}
          >
            <Pill className="h-4 w-4 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {nomApp}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
            Administration
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {menuItems.map((groupe) => (
          <div key={groupe.label}>
            <span
              className="block px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest"
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
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-all relative',
                      isActive
                        ? 'font-semibold'
                        : '',
                    ].join(' ')
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                          color: 'var(--color-primary)',
                        }
                      : {
                          color: 'var(--text-secondary)',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.classList.contains('active')) {
                      e.currentTarget.style.background = 'var(--surface-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.getAttribute('aria-current')) {
                      e.currentTarget.style.background = '';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                          style={{ background: 'var(--color-primary)' }}
                        />
                      )}
                      <item.icon
                        className="h-[17px] w-[17px] shrink-0"
                        style={{ color: isActive ? 'var(--color-primary)' : 'var(--text-muted)' }}
                      />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User info */}
      <div
        className="shrink-0 p-3"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: 'var(--surface-overlay)' }}
        >
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {user?.prenom} {user?.nom}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              {roleLabel}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md transition-colors"
            title="Déconnexion"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--color-danger) 10%, transparent)';
              e.currentTarget.style.color = 'var(--color-danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div data-theme="admin" className="min-h-screen flex" style={{ background: 'var(--surface-base)' }}>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar desktop */}
      <aside
        className="fixed inset-y-0 left-0 z-50 hidden lg:flex flex-col"
        style={{
          width: SIDEBAR_WIDTH,
          borderRight: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          background: 'var(--surface-raised)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col lg:hidden transition-transform duration-300`}
        style={{
          width: SIDEBAR_WIDTH,
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--surface-raised)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <div className="flex items-center justify-end p-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-md"
            style={{ color: 'var(--text-muted)', background: 'var(--surface-hover)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Main content area */}
      <div
        id="admin-main-content"
        className="flex-1 min-w-0 flex flex-col"
      >
        {/* Topbar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-6"
          style={{
            height: 64,
            background: 'var(--surface-raised)',
            borderBottom: '1px solid var(--border-subtle)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Burger mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)', background: 'var(--surface-hover)' }}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Fil d'Ariane */}
            <nav className="flex items-center gap-1 text-sm">
              {ariane.map((crumb, i) => (
                <span key={crumb.label} className="flex items-center gap-1">
                  {i > 0 && (
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                  )}
                  {crumb.path ? (
                    <NavLink
                      to={crumb.path}
                      className="hover:underline"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {crumb.label}
                    </NavLink>
                  ) : (
                    <span
                      className="font-semibold"
                      style={{ color: crumb.isPrimary ? 'var(--color-primary)' : 'var(--text-primary)' }}
                    >
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Date */}
            <span
              className="hidden sm:inline text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </span>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)', background: 'var(--surface-hover)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-active)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-hover)';
                }}
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

            {/* Avatar cliquable */}
            <div style={{ position: 'relative' }} ref={profileRef}>
              <button
                onClick={() => setProfileOpen((p) => !p)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-opacity hover:opacity-80"
                style={{ background: 'var(--color-primary)' }}
                title={`${user?.prenom} ${user?.nom}`}
              >
                {initials}
              </button>

              {profileOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 200,
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-modal)',
                    zIndex: 200,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {user?.prenom} {user?.nom}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{roleLabel}</p>
                  </div>
                  <div style={{ padding: '6px 0' }}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                      onClick={() => { setProfileOpen(false); navigate('/admin/profil'); }}
                    >
                      <User className="h-4 w-4" />
                      {t('profile')}
                    </button>
                    <Link
                      to="/changer-mot-de-passe"
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                      onClick={() => setProfileOpen(false)}
                    >
                      <KeyRound className="h-4 w-4" />
                      {t('change_password')}
                    </Link>
                    <div style={{ margin: '4px 12px', height: 1, background: 'var(--border-subtle)' }} />
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--color-danger)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--color-danger) 10%, transparent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                      onClick={() => { setProfileOpen(false); handleLogout(); }}
                    >
                      <LogOut className="h-4 w-4" />
                      {t('logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            padding: '2rem',
            maxWidth: 1440,
            width: '100%',
          }}
        >
          <PageTransition />
        </main>
      </div>

      {/* Offset for sidebar on desktop */}
      <style>{`
        @media (min-width: 1024px) {
          #admin-main-content {
            margin-left: ${SIDEBAR_WIDTH}px;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminLayout;
