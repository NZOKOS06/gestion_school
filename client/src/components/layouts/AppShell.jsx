import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import PageTransition from '../transitions/PageTransition';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import {
  GraduationCap,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
  User,
  KeyRound,
  Search,
  AlignJustify,
  MoreHorizontal,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationsPanel } from '../NotificationsPanel';
import { ThemeToggle, DropdownMenu, DropdownItem, DropdownSeparator } from '../ui';
import { useI18n } from '../../contexts/I18nContext';
import { useDensity } from '../../contexts/DensityContext';
import CommandPalette from '../CommandPalette';
import { buildBreadcrumbs, ROLE_DISPLAY_LABELS } from './navConfig';

const BOTTOM_NAV_SLOTS = 4;

/**
 * Unified app shell for admin / enseignant / parent / caissier.
 * Mobile (< lg): bottom nav + drawer. Desktop: fixed sidebar.
 */
const AppShell = ({
  navGroups,
  routeLabels,
  homePath,
  homeLabel = 'GestSchool',
  brandSubtitle,
  sidebarWidth = 256,
  profilePath,
  contentMaxWidth = 1440,
  contentPadding = '2rem',
  showDate = true,
  densityToggle = true,
  commandPages = [],
}) => {
  const { user, logout } = useAuth();
  const { config, isModuleActive } = useTenant();
  const { t } = useI18n();
  const { density, toggleDensity } = useDensity();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, markRead, clear } = useNotifications();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close drawer on route change (mobile) — évite focus piégé + aria-hidden
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = useMemo(() => {
    const role = user?.role;
    return navGroups
      .map((g) => ({
        label: t(g.groupKey) !== g.groupKey ? t(g.groupKey) : (g.label || t(g.groupKey)),
        items: g.items
          .filter((item) => {
            if (item.module && !isModuleActive(item.module)) return false;
            if (item.roles?.length && role && !item.roles.includes(role) && role !== 'super_admin') {
              return false;
            }
            return true;
          })
          .map((item) => ({
            ...item,
            label: item.label || (t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.labelKey),
          })),
      }))
      .filter((g) => g.items.length > 0);
  }, [navGroups, isModuleActive, user?.role, t]);

  const flatItems = useMemo(() => menuItems.flatMap((g) => g.items), [menuItems]);

  const bottomNavItems = useMemo(() => {
    const primary = flatItems.filter((i) => i.primary);
    const pool = primary.length ? primary : flatItems;
    return pool.slice(0, BOTTOM_NAV_SLOTS);
  }, [flatItems]);

  const ariane = buildBreadcrumbs(pathname, routeLabels, homePath, homeLabel);
  const currentCrumb = ariane[ariane.length - 1];
  const nomApp = config?.nomApp || 'GestSchool';
  const initials = `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`;
  const roleLabel = ROLE_DISPLAY_LABELS[user?.role] || user?.role || '';

  const palettePages = useMemo(() => {
    if (commandPages.length) return commandPages;
    return menuItems.flatMap((g) =>
      g.items.map((item) => ({
        path: item.path,
        label: item.label,
        icon: item.icon,
        group: g.label,
      }))
    );
  }, [commandPages, menuItems]);

  const isNavActive = (path) => {
    if (path === homePath || path === '/caissier') return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const sidebarContent = (
    <div className="h-full flex flex-col" style={{ background: 'var(--surface-raised)' }}>
      <div
        className="shrink-0 flex items-center gap-3 px-5"
        style={{
          height: 64,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {config?.logoUrl ? (
          <img src={config.logoUrl} alt={nomApp} className="h-8 w-auto max-w-[120px] object-contain" />
        ) : (
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-primary)' }}
          >
            <GraduationCap className="h-4 w-4" style={{ color: 'var(--color-primary-fg)' }} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {nomApp}
          </p>
          {brandSubtitle && (
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
              {brandSubtitle}
            </p>
          )}
        </div>
      </div>

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
                  end={item.path === homePath || item.path === '/caissier'}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 h-11 rounded-lg text-sm font-medium transition-all relative"
                  style={({ isActive }) =>
                    isActive
                      ? {
                          background: 'var(--surface-brand-soft)',
                          color: 'var(--color-primary)',
                          fontWeight: 600,
                        }
                      : { color: 'var(--text-secondary)' }
                  }
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

      <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: 'var(--surface-overlay)' }}
        >
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {user?.prenom} {user?.nom}
            </p>
            <p className="text-[11px] truncate capitalize" style={{ color: 'var(--text-muted)' }}>
              {roleLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-md transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]"
            title="Déconnexion"
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const compactPad = density === 'compact';

  return (
    <div
      data-theme="admin"
      className="min-h-screen flex"
      style={{ background: 'var(--surface-base)', '--sidebar-w': `${sidebarWidth}px` }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-50 hidden lg:flex flex-col"
        style={{
          width: sidebarWidth,
          borderRight: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          background: 'var(--surface-raised)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex flex-col lg:hidden transition-transform duration-300 ease-out"
        style={{
          width: sidebarWidth,
          maxWidth: '88vw',
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--surface-raised)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-105%)',
          pointerEvents: sidebarOpen ? 'auto' : 'none',
        }}
        aria-hidden={!sidebarOpen}
        inert={sidebarOpen ? undefined : ''}
      >
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider px-2" style={{ color: 'var(--text-muted)' }}>
            Menu
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
            style={{ color: 'var(--text-muted)', background: 'var(--surface-hover)' }}
            aria-label="Fermer le menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {sidebarContent}
      </aside>

      <div id="app-shell-main" className="flex-1 min-w-0 flex flex-col lg:ml-[var(--sidebar-w)]">
        <header
          className="sticky top-0 z-30 flex items-center justify-between gap-2 px-3 sm:px-6"
          style={{
            height: 56,
            background: 'var(--surface-raised)',
            borderBottom: '1px solid var(--border-subtle)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Desktop: no hamburger. Mobile: menu opens full nav (Plus also does) */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              style={{ color: 'var(--text-secondary)', background: 'var(--surface-hover)' }}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Mobile: page title only */}
            <h1
              className="lg:hidden text-[15px] font-semibold truncate"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
            >
              {currentCrumb?.label || homeLabel}
            </h1>

            {/* Desktop breadcrumbs */}
            <nav className="hidden lg:flex items-center gap-1 text-sm truncate">
              {ariane.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />}
                  {crumb.path && !crumb.isPrimary ? (
                    <NavLink to={crumb.path} className="hover:underline" style={{ color: 'var(--text-secondary)' }}>
                      {crumb.label}
                    </NavLink>
                  ) : (
                    <span
                      className="font-semibold truncate"
                      style={{ color: crumb.isPrimary ? 'var(--color-primary)' : 'var(--text-primary)' }}
                    >
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {showDate && (
              <span className="hidden md:inline text-xs font-medium capitalize" style={{ color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            )}

            {/* Search: icon on mobile, full on sm+ */}
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="inline-flex items-center justify-center gap-2 h-10 w-10 sm:h-8 sm:w-auto sm:px-2.5 rounded-lg text-xs min-h-[44px] sm:min-h-0"
              style={{
                color: 'var(--text-muted)',
                background: 'var(--surface-hover)',
                border: '1px solid var(--border-subtle)',
              }}
              title="Recherche (Ctrl+K)"
              aria-label="Rechercher"
            >
              <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Rechercher…</span>
              <kbd
                className="hidden sm:inline ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
              >
                ⌘K
              </kbd>
            </button>

            {densityToggle && (
              <button
                type="button"
                onClick={toggleDensity}
                className="p-2 rounded-lg hidden sm:inline-flex"
                title={density === 'compact' ? 'Densité confortable' : 'Densité compacte'}
                style={{ color: 'var(--text-secondary)', background: 'var(--surface-hover)' }}
              >
                <AlignJustify className="h-4 w-4" />
              </button>
            )}

            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ color: 'var(--text-secondary)', background: 'var(--surface-hover)' }}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--color-danger)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
                  onMarkAllRead={() => markAllRead()}
                  onMarkRead={markRead}
                  onClear={clear}
                />
              )}
            </div>

            <DropdownMenu
              trigger={
                <button
                  type="button"
                  className="h-9 w-9 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs font-bold transition-opacity hover:opacity-80"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
                  title={`${user?.prenom} ${user?.nom}`}
                >
                  {initials}
                </button>
              }
            >
              <div className="px-2.5 py-2 border-b mb-1" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {user?.prenom} {user?.nom}
                </p>
                <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{roleLabel}</p>
              </div>
              {profilePath && (
                <DropdownItem icon={User} onSelect={() => navigate(profilePath)}>
                  {t('profile') !== 'profile' ? t('profile') : 'Profil'}
                </DropdownItem>
              )}
              <DropdownItem icon={KeyRound} onSelect={() => navigate('/changer-mot-de-passe')}>
                {t('change_password') !== 'change_password' ? t('change_password') : 'Mot de passe'}
              </DropdownItem>
              <div className="sm:hidden px-1 py-1">
                <ThemeToggle />
              </div>
              <DropdownSeparator />
              <DropdownItem icon={LogOut} danger onSelect={handleLogout}>
                {t('logout') !== 'logout' ? t('logout') : 'Déconnexion'}
              </DropdownItem>
            </DropdownMenu>
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto px-3 sm:px-5 lg:px-8"
          style={{
            paddingTop: compactPad ? '0.875rem' : '1.25rem',
            paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
            maxWidth: contentMaxWidth,
            width: '100%',
          }}
        >
          <PageTransition />
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40"
          style={{
            background: 'var(--surface-raised)',
            borderTop: '1px solid var(--border-subtle)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
          }}
          aria-label="Navigation principale"
        >
          <div className="flex items-stretch justify-around h-14 max-w-lg mx-auto">
            {bottomNavItems.map((item) => {
              const active = isNavActive(item.path);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === homePath || item.path === '/caissier'}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 px-1"
                  style={{ color: active ? 'var(--color-primary)' : 'var(--text-muted)' }}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                  <span className="text-[10px] font-medium truncate max-w-full leading-tight">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 px-1"
              style={{ color: sidebarOpen ? 'var(--color-primary)' : 'var(--text-muted)' }}
              aria-label="Plus de menus"
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={sidebarOpen ? 2.25 : 1.75} />
              <span className="text-[10px] font-medium">Plus</span>
            </button>
          </div>
        </nav>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} pages={palettePages} />

      <style>{`
        @media (min-width: 1024px) {
          #app-shell-main main {
            padding: ${compactPad ? '1.25rem' : contentPadding} !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AppShell;
