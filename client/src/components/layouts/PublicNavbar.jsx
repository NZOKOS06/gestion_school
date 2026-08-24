import { Link } from 'react-router-dom';
import { GraduationCap, Menu, X, Phone } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';

const PublicNavbar = ({ config, links, loginLabel = 'Connexion', menuOuvert, setMenuOuvert }) => {
  const nomApp = config?.nomApp || 'GestSchool';

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          background: 'var(--surface-raised)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            <Link to="/" className="flex items-center gap-2.5 shrink-0 min-w-0">
              {config?.logoUrl ? (
                <img src={config.logoUrl} alt={nomApp} className="h-8 sm:h-9 w-auto shrink-0" />
              ) : (
                <GraduationCap className="h-7 w-7 shrink-0" style={{ color: 'var(--color-primary)' }} />
              )}
              <span className="text-base sm:text-xl font-semibold tracking-tight truncate max-w-[140px] sm:max-w-none" style={{ color: 'var(--color-primary)' }}>
                {nomApp}
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
              {links.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-sm font-medium tracking-wide transition-colors hover:text-[var(--color-primary)]"
                  style={{ color: link.active ? 'var(--color-primary)' : 'var(--text-secondary)' }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {config?.telephone && (
                <a
                  href={`tel:${config.telephone}`}
                  className="md:hidden h-10 w-10 rounded-full flex items-center justify-center text-white transition-all hover:shadow-md"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  aria-label="Appeler l'établissement"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
              <ThemeToggle />
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center px-5 py-2.5 text-sm font-medium tracking-wide rounded-full text-white transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {loginLabel}
              </Link>

              <button
                type="button"
                className="md:hidden p-2 rounded-lg hover:bg-[var(--surface-hover)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setMenuOuvert(true)}
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {menuOuvert && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMenuOuvert(false)} />
          <nav
            className="absolute right-0 top-0 h-full w-72 flex flex-col"
            style={{
              background: 'var(--surface-raised)',
              boxShadow: 'var(--shadow-modal)',
              animation: 'slideIn 250ms ease both',
            }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-primary)' }}>{nomApp}</span>
              <button
                type="button"
                onClick={() => setMenuOuvert(false)}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)]"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="flex flex-col gap-1 p-4 flex-1">
              {links.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setMenuOuvert(false)}
                  className="px-4 py-3 text-sm tracking-wide rounded-lg transition-colors"
                  style={{
                    color: link.active ? 'var(--color-primary)' : 'var(--text-secondary)',
                    background: link.active ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!link.active) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { if (!link.active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <Link
                to="/login"
                onClick={() => setMenuOuvert(false)}
                className="block w-full text-center px-5 py-3 text-sm font-medium rounded-full text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {loginLabel}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
};

export default PublicNavbar;
