import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import PageTransition from '../transitions/PageTransition';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { DollarSign, LogOut, Menu, GraduationCap, Wallet, AlertCircle, History } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '../ui';

const SIDEBAR_WIDTH = 240;

const CaissierLayout = () => {
  const { user, logout } = useAuth();
  const { config } = useTenant();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const nomApp = config?.nomApp || 'GestSchool';
  const isCaisseActive = pathname === '/caissier' || pathname === '/caissier/';
  const isEncaisserActive = pathname.startsWith('/caissier/encaisser');
  const isRetardsActive = pathname === '/caissier/retards';
  const isHistoriqueActive = pathname === '/caissier/historique';

  const navItemClass = (active) =>
    [
      'flex items-center gap-2.5 px-3 h-9 rounded-md text-sm font-medium transition-all',
      'relative overflow-hidden',
      active
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
        <div>
          <span
            className="block px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            Caisse
          </span>
          <div className="space-y-0.5">
            <NavLink
              to="/caissier"
              onClick={() => setSidebarOpen(false)}
              className={navItemClass(isCaisseActive)}
              style={isCaisseActive ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' } : {}}
            >
              {isCaisseActive && activeIndicator}
              <Wallet className="h-[18px] w-[18px] shrink-0" />
              <span>Caisse du jour</span>
            </NavLink>
            <NavLink
              to="/caissier/encaisser"
              onClick={() => setSidebarOpen(false)}
              className={navItemClass(isEncaisserActive)}
              style={isEncaisserActive ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' } : {}}
            >
              {isEncaisserActive && activeIndicator}
              <DollarSign className="h-[18px] w-[18px] shrink-0" />
              <span>Encaisser un paiement</span>
            </NavLink>
            <NavLink
              to="/caissier/retards"
              onClick={() => setSidebarOpen(false)}
              className={navItemClass(isRetardsActive)}
              style={isRetardsActive ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' } : {}}
            >
              {isRetardsActive && activeIndicator}
              <AlertCircle className="h-[18px] w-[18px] shrink-0" />
              <span>Échéances en retard</span>
            </NavLink>
            <NavLink
              to="/caissier/historique"
              onClick={() => setSidebarOpen(false)}
              className={navItemClass(isHistoriqueActive)}
              style={isHistoriqueActive ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' } : {}}
            >
              {isHistoriqueActive && activeIndicator}
              <History className="h-[18px] w-[18px] shrink-0" />
              <span>Historique des reçus</span>
            </NavLink>
          </div>
        </div>
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
              Comptable
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
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Comptable
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxWidth: 1400 }}>
          <PageTransition />
        </main>
      </div>
    </div>
  );
};

export default CaissierLayout;
