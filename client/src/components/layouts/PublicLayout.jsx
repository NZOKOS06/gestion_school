import { Outlet, useLocation, Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { GraduationCap, Phone, MapPin, Clock } from 'lucide-react';
import { ThemeToggle } from '../ui';
import { CookieConsent } from '../ui/CookieConsent';

const PublicLayout = () => {
  const { config, loading } = useTenant();
  const { pathname } = useLocation();
  const pageAutonome =
    pathname === '/' ||
    pathname.startsWith('/e/');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] dark:bg-[#0d1117]">
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  // Accueil et pages école gèrent leur propre navigation
  if (pageAutonome) {
    return <Outlet />;
  }

  const fallbackStyle = {
    '--color-primary': '#16A34A',
    '--color-secondary': '#15803D',
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--surface-base)', ...(!config ? fallbackStyle : {}) }}>
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'var(--surface-raised)', borderColor: 'var(--border-subtle)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="/" className="flex items-center gap-3">
              {config?.logoUrl ? (
                <img src={config.logoUrl} alt={config.nomApp} className="h-10 w-auto" />
              ) : (
                <GraduationCap className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
              )}
              <span
                className="text-xl font-semibold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}
              >
                {config?.nomApp || 'GestSchool'}
              </span>
            </a>

            <nav className="hidden md:flex items-center gap-4">
              <a href="/" className="text-sm font-medium transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--text-secondary)' }}>Accueil</a>
              <a href="/actualites" className="text-sm font-medium transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--text-secondary)' }}>Actualités</a>
              <ThemeToggle />
              <Link to="/login" className="inline-flex items-center px-5 py-2 text-sm font-medium rounded-full text-white transition-all hover:shadow-md hover:-translate-y-0.5" style={{ backgroundColor: 'var(--color-primary)' }}>Connexion</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="mt-auto" style={{ background: '#0F1117', color: '#fff' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3
                className="font-semibold mb-3"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {config?.nomApp || 'GestSchool'}
              </h3>
              <p className="text-gray-400 text-sm">
                {config?.messageAccueil || 'Plateforme de gestion scolaire'}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">Contact</h3>
              <div className="space-y-2 text-sm text-gray-400">
                {config?.adresse && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {config.adresse}
                  </p>
                )}
                {config?.telephone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {config.telephone}
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">Horaires</h3>
              {config?.horaireOuverture ? (
                <div className="space-y-1 text-sm text-gray-400">
                  {Object.entries(config.horaireOuverture).map(([jour, horaire]) => (
                    <p key={jour} className="flex items-center gap-2 capitalize">
                      <Clock className="h-4 w-4" />
                      <span>{jour}:</span> {horaire}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Du lundi au samedi : 8h – 18h</p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <span>© 2026 {config?.nomApp || 'GestSchool'}. Tous droits réservés.</span>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/politique-confidentialite" className="hover:text-white transition-colors">
                Confidentialité
              </Link>
              <Link to="/conditions-utilisation" className="hover:text-white transition-colors">
                Conditions d'utilisation
              </Link>
              <Link to="/politique-cookies" className="hover:text-white transition-colors">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <CookieConsent />
    </div>
  );
};

export default PublicLayout;
