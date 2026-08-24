import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  CalendarDays,
  Wallet,
  FileText,
  Users,
  Shield,
  Clock,
  Award,
  Bell,
  Menu,
  X,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  School,
  ClipboardList,
  TrendingUp,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import Footer from '../../components/layouts/Footer';

const Home = () => {
  const { config, slug } = useTenant();
  const { t } = useI18n();
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOuvert ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOuvert]);

  const nomApp = config?.nomApp || config?.nomEcole || 'GestSchool';
  const slogan = config?.slogan || config?.messageAccueil || 'L\'excellence éducative au service de votre avenir';

  const loginLink = slug ? `/e/${slug}/login` : '/login';

  const NAV_LINKS = [
    { label: 'Accueil', to: '/' },
    { label: 'Actualités', to: slug ? `/e/${slug}/actualites` : '/actualites' },
    { label: 'Contact', to: '#contact' },
  ];

  // Fonctionnalités scolaires
  const features = [
    { icon: GraduationCap, title: 'Gestion des élèves', description: 'Inscriptions, dossiers, matricules, suivi complet' },
    { icon: BookOpen, title: 'Notes & Bulletins', description: 'Saisie des notes, calcul des moyennes, génération de bulletins PDF' },
    { icon: CalendarDays, title: 'Emploi du temps', description: 'Planification des cours par classe et par enseignant' },
    { icon: Wallet, title: 'Paiements & Échéances', description: 'Suivi des scolarités, tranches, relances automatiques' },
    { icon: ClipboardList, title: 'Absences & Discipline', description: 'Appel, justifications, sanctions et suivi du comportement' },
    { icon: Award, title: 'Certificats', description: 'Attestations de scolarité, d\'inscription, de fin d\'études' },
  ];

  // Statistiques
  const stats = [
    { value: '500+', label: 'Élèves gérés' },
    { value: '20+', label: 'Classes actives' },
    { value: '50+', label: 'Enseignants' },
    { value: '99%', label: 'Satisfaction' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-base)' }}>
      {/* Navbar */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: 'color-mix(in srgb, var(--surface-base) 85%, transparent)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              {config?.logoUrl ? (
                <img src={config.logoUrl} alt={nomApp} className="h-8 w-auto" />
              ) : (
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
              )}
              <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {nomApp}
              </span>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-sm font-medium transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to={loginLink}
                className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:shadow-lg"
                style={{ background: 'var(--color-primary)' }}
              >
                {t('login') || 'Connexion'}
              </Link>
            </div>

            {/* Mobile burger */}
            <button
              onClick={() => setMenuOuvert(!menuOuvert)}
              className="md:hidden p-2 rounded-lg"
              style={{ color: 'var(--text-primary)' }}
            >
              {menuOuvert ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOuvert && (
          <div className="md:hidden border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-raised)' }}>
            <div className="px-4 py-3 space-y-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setMenuOuvert(false)}
                  className="block py-2 text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to={loginLink}
                onClick={() => setMenuOuvert(false)}
                className="block py-2.5 px-4 text-sm font-semibold text-white rounded-lg text-center"
                style={{ background: 'var(--color-primary)' }}
              >
                {t('login') || 'Connexion'}
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{
                background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                color: 'var(--color-primary)',
              }}
            >
              <School className="h-3.5 w-3.5" />
              Plateforme SaaS de gestion scolaire
            </div>

            <h1
              className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-4 sm:mb-6 px-1"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
            >
              {nomApp}
            </h1>

            <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 leading-relaxed max-w-2xl mx-auto px-1" style={{ color: 'var(--text-secondary)' }}>
              {slogan}
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center items-stretch sm:items-center px-4 sm:px-0">
              <Link
                to={loginLink}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white rounded-full shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 min-h-[48px]"
                style={{ background: 'var(--color-primary)' }}
              >
                {t('login') || 'Connexion'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold rounded-full border-2 transition-all hover:shadow-md hover:-translate-y-0.5 min-h-[48px]"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                Découvrir
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-12 sm:mt-20 max-w-4xl mx-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
                  {stat.value}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28" style={{ background: 'var(--surface-raised)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Une plateforme complète pour votre établissement
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Tous les outils nécessaires pour gérer efficacement votre école, du préscolaire au lycée.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl p-6 transition-all duration-300 hover:shadow-lg"
                style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)' }}
              >
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
                >
                  <feature.icon className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {feature.title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div
            className="rounded-3xl p-12 md:p-16"
            style={{ background: 'var(--color-primary)' }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Prêt à digitaliser votre établissement ?
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Rejoignez les écoles qui ont choisi GestSchool pour une gestion moderne et efficace.
            </p>
            <Link
              to={loginLink}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold rounded-full bg-white transition-all hover:shadow-xl hover:-translate-y-0.5"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('login') || 'Connexion'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Contact / Footer */}
      <div id="contact">
        <Footer />
      </div>
    </div>
  );
};

export default Home;
