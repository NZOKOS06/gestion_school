import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import PublicNavbar from '../../components/layouts/PublicNavbar';
import Footer from '../../components/layouts/Footer';

// Fonction utilitaire pour normaliser les URLs d'images
const normalizeImageUrl = (url) => {
  if (!url) return null;
  return url; // Utiliser l'URL telle quelle (relative ou complète)
};
import {
  Pill,
  Shield,
  Clock,
  Truck,
  FileText,
  Package,
  CheckCircle2,
  MapPin,
  Phone,
  Cross,
  Syringe,
  FlaskConical,
  HeartPulse,
  ChevronDown,
  Upload,
  FileText as FileIcon,
  Loader2,
  UserRound,
} from 'lucide-react';
import FloatingPrescriptionButton from '../../components/public/FloatingPrescriptionButton.jsx';
import axios from 'axios';
import toast from 'react-hot-toast';

const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];


const DUREE_ANIMATION_STAT = 1400;

function parsePlageHoraire(horaire) {
  const match = horaire?.match(/(\d{1,2})\s*h?\s*[-–]\s*(\d{1,2})/i);
  if (!match) return null;
  return { debut: parseInt(match[1], 10), fin: parseInt(match[2], 10) };
}

function estOuvertMaintenant(horaires) {
  if (!horaires) return false;
  const maintenant = new Date();
  const jour = JOURS_SEMAINE[maintenant.getDay()];
  const plage = horaires[jour];
  if (!plage || /fermé/i.test(plage)) return false;
  const heures = parsePlageHoraire(plage);
  if (!heures) return false;
  const heureActuelle = maintenant.getHours() + maintenant.getMinutes() / 60;
  return heureActuelle >= heures.debut && heureActuelle < heures.fin;
}

function horaireDuJour(horaires, closedLabel) {
  if (!horaires) return '8h – 18h';
  const jour = JOURS_SEMAINE[new Date().getDay()];
  return horaires[jour] || closedLabel;
}

function soulignerMotCle(texte) {
  const virgule = texte.indexOf(',');
  if (virgule !== -1) {
    const debut = texte.slice(0, virgule + 1);
    const fin = texte.slice(virgule + 1).trim();
    return { debut, fin };
  }
  const mots = texte.split(' ');
  if (mots.length <= 2) return { debut: texte, fin: null };
  const moitie = Math.ceil(mots.length / 2);
  return { debut: mots.slice(0, moitie).join(' '), fin: mots.slice(moitie).join(' ') };
}

function useCompteur(cible, actif) {
  const [valeur, setValeur] = useState(0);
  useEffect(() => {
    if (!actif || !cible) return;
    const debut = performance.now();
    const tick = (maintenant) => {
      const progres = Math.min((maintenant - debut) / DUREE_ANIMATION_STAT, 1);
      const ease = 1 - Math.pow(1 - progres, 3);
      setValeur(Math.round(ease * cible));
      if (progres < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [cible, actif]);
  return valeur;
}

function StatItem({ stat, actif }) {
  const compteur = useCompteur(stat.valeur, actif && stat.valeur != null);
  const affichage = stat.valeur != null ? `${compteur}${stat.suffixe || ''}` : stat.texte;
  return (
    <div className="text-center px-6">
      <p className="text-3xl md:text-[40px] font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
        {affichage}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {stat.label}
      </p>
    </div>
  );
}

function HeroTitre({ slogan }) {
  if (!slogan) {
    return (
      <h1 className="text-4xl md:text-[54px] font-bold tracking-tight leading-[1.15]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em' }}>
        Votre santé,
        <br />
        <span className="relative inline-block" style={{ color: 'var(--color-primary)' }}>
          notre priorité
          <svg className="absolute -bottom-1 left-0 w-full h-[4px]" viewBox="0 0 200 4" preserveAspectRatio="none">
            <path d="M0 2 Q50 0 100 2 T200 2" stroke="var(--color-primary)" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </span>
      </h1>
    );
  }
  const { debut, fin } = soulignerMotCle(slogan);
  if (!fin) {
    return (
      <h1 className="text-4xl md:text-[54px] font-bold tracking-tight leading-[1.15]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em' }}>
        {slogan}
      </h1>
    );
  }
  return (
    <h1 className="text-4xl md:text-[54px] font-bold tracking-tight leading-[1.15]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em' }}>
      {debut}
      <br />
      <span className="relative inline-block" style={{ color: 'var(--color-primary)' }}>
        {fin}
        <svg className="absolute -bottom-1 left-0 w-full h-[4px]" viewBox="0 0 200 4" preserveAspectRatio="none">
          <path d="M0 2 Q50 0 100 2 T200 2" stroke="var(--color-primary)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      </span>
    </h1>
  );
}

const FAQ_ITEMS = [
  { q: 'faq_q1', a: 'faq_a1' },
  { q: 'faq_q2', a: 'faq_a2' },
  { q: 'faq_q3', a: 'faq_a3' },
  { q: 'faq_q4', a: 'faq_a4' },
  { q: 'faq_q5', a: 'faq_a5' },
];

const SERVICES_VITRINE = [
  { icon: Syringe, titleKey: 'svc_vaccination', descKey: 'svc_vaccination_desc' },
  { icon: HeartPulse, titleKey: 'svc_conseil', descKey: 'svc_conseil_desc' },
  { icon: FlaskConical, titleKey: 'svc_preparation', descKey: 'svc_preparation_desc' },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const Home = () => {
  const { config, isModuleActive } = useTenant();
  const { t } = useI18n();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [statsVisibles, setStatsVisibles] = useState(false);
  const statsRef = useRef(null);

  // FAQ accordion state
  const [faqOpen, setFaqOpen] = useState(null);

  // Quick prescription state
  const [rxFile, setRxFile] = useState(null);
  const [rxApercu, setRxApercu] = useState(null);
  const [rxDragOver, setRxDragOver] = useState(false);
  const [rxSending, setRxSending] = useState(false);
  const rxInputRef = useRef(null);

  const commandeActive = isModuleActive('commandeEnLigne');

  const traiterFichier = (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t('quick_rx_formats'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('5 Mo max');
      return;
    }
    setRxFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setRxApercu(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setRxApercu(null);
    }
  };

  const envoyerOrdonnanceRapide = async () => {
    if (!rxFile) return;
    setRxSending(true);
    try {
      const fd = new FormData();
      fd.append('ordonnanceFile', rxFile);
      fd.append('items', JSON.stringify([]));
      await axios.post('/api/public/commandes', fd, {
        headers: { 'Content-Type': undefined },
      });
      toast.success(t('quick_rx_sent'));
      setRxFile(null);
      setRxApercu(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    } finally {
      setRxSending(false);
    }
  };

  const ouvert = estOuvertMaintenant(config?.horaireOuverture);
  const slogan = config?.sloganApp;

  const NAV_LINKS = [
    { labelKey: 'nav_home', to: '/' },
    { labelKey: 'nav_catalogue', to: '/catalogue' },
    { labelKey: 'nav_contact', to: '#contact' },
  ];

  const SERVICES = [
    t('service_1'),
    t('service_2'),
    t('service_3'),
    t('service_4'),
  ];

  const features = [
    {
      icon: Package,
      title: t('feat_range_title'),
      description: t('feat_range_desc'),
    },
    {
      icon: Shield,
      title: t('feat_pharmacist_title'),
      description: `Conseil par ${config?.nomPharmacien || 'notre pharmacien titulaire'}`,
    },
    {
      icon: Clock,
      title: t('feat_speed_title'),
      description: t('feat_speed_desc'),
    },
    {
      icon: FileText,
      title: t('feat_prescriptions_title'),
      description: t('feat_prescriptions_desc'),
    },
    ...(isModuleActive('livraison') ? [{
      icon: Truck,
      title: t('feat_delivery_title'),
      description: `À domicile dès ${config?.fraisLivraison || 0} FCFA`,
    }] : []),
    {
      icon: Pill,
      title: t('feat_stock_title'),
      description: t('feat_stock_desc'),
    },
  ];

  const delaiLivraison = config?.zonesLivraison?.[0]?.delai || '2h';
  const stats = [
    { valeur: null, texte: horaireDuJour(config?.horaireOuverture, t('closed_today')), label: t('stat_service') },
    ...(isModuleActive('livraison')
      ? [{ valeur: null, texte: delaiLivraison, label: t('stat_delivery') }]
      : []),
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStatsVisibles(true);
      },
      { threshold: 0.4 }
    );

    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  // Bloque le scroll quand le drawer mobile est ouvert
  useEffect(() => {
    document.body.style.overflow = menuOuvert ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOuvert]);

  const nomApp = config?.nomApp || 'GestPharma';

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-base)' }}>
      <PublicNavbar
        config={config}
        links={NAV_LINKS.map((l) => ({ label: t(l.labelKey), to: l.to }))}
        loginLabel={t('nav_login')}
        menuOuvert={menuOuvert}
        setMenuOuvert={setMenuOuvert}
      />

      <section
        className="relative overflow-hidden"
        style={{
          background: config?.heroVideoUrl
            ? 'var(--surface-base)'
            : (config?.heroImageUrl
              ? `url(${normalizeImageUrl(config.heroImageUrl)}) center/cover no-repeat`
              : (config?.backgroundImageUrl
                ? `url(${normalizeImageUrl(config.backgroundImageUrl)}) center/cover no-repeat`
                : 'var(--surface-base)'))
        }}
      >
        {config?.heroVideoUrl && (
          <video
            src={normalizeImageUrl(config.heroVideoUrl)}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-[52%_48%] gap-16 lg:gap-12 items-center">
            <div className="space-y-8">
              <HeroTitre slogan={slogan} />
              <p className="text-lg max-w-[500px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {config?.nom
                  ? `${config.nom} — pharmacie de proximité, conseils personnalisés et produits de qualité.`
                  : 'Pharmacie de proximité, conseils personnalisés et produits de qualité pour toute la famille.'}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/catalogue"
                  className="inline-flex items-center px-8 py-3.5 text-sm font-medium text-white rounded-full shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {t('btn_discover')}
                </Link>
                {isModuleActive('commandeEnLigne') && (
                  <Link
                    to="/commander"
                    className="inline-flex items-center px-8 py-3.5 text-sm font-medium rounded-full border-2 transition-all hover:shadow-md hover:-translate-y-0.5"
                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    {t('btn_order')}
                  </Link>
                )}
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div
                className="w-full max-w-md rounded-3xl p-10"
                style={{
                  background: 'var(--surface-raised)',
                  boxShadow: 'var(--shadow-modal)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex justify-center mb-8">
                  <Cross className="h-24 w-24" style={{ color: 'var(--color-primary)' }} strokeWidth={1} />
                </div>
                <div className="text-center space-y-5">
                  <h3 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {t('opening_hours')}
                  </h3>
                  <p className="text-base capitalize" style={{ color: 'var(--text-secondary)' }}>
                    {t('today')} : {horaireDuJour(config?.horaireOuverture, t('closed_today'))}
                  </p>
                  {ouvert && (
                    <span
                      className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-sm font-medium"
                      style={{ background: 'color-mix(in srgb, var(--color-success) 12%, transparent)', color: 'var(--color-success)' }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                      {t('open_now')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        ref={statsRef}
        className="border-y"
        style={{ background: 'var(--surface-raised)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className={`grid grid-cols-1 gap-10 ${stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {stats.map((stat) => (
              <StatItem key={stat.label} stat={stat} actif={statsVisibles} />
            ))}
          </div>
        </div>
      </section>

      <section
        className="py-20 md:py-28 relative"
        style={{
          background: config?.featuresVideoUrl
            ? 'var(--surface-base)'
            : (config?.featuresImageUrl
              ? `url(${normalizeImageUrl(config.featuresImageUrl)}) center/cover no-repeat`
              : 'var(--surface-base)')
        }}
      >
        {config?.featuresVideoUrl && (
          <video
            src={normalizeImageUrl(config.featuresVideoUrl)}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h2
            className="text-center text-3xl md:text-4xl font-bold tracking-tight mb-16"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}
          >
            {t('why_choose_us')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white dark:bg-[#161b22] rounded-2xl p-8 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                style={{
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}
                >
                  <feature.icon className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h3 className="font-semibold text-lg mb-3" style={{ color: 'var(--text-primary)' }}>{feature.title}</h3>
                <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="py-20 md:py-28 relative"
        style={{
          background: config?.aboutVideoUrl
            ? 'var(--surface-raised)'
            : (config?.aboutImageUrl
              ? `url(${normalizeImageUrl(config.aboutImageUrl)}) center/cover no-repeat`
              : 'var(--surface-raised)')
        }}
      >
        {config?.aboutVideoUrl && (
          <video
            src={normalizeImageUrl(config.aboutVideoUrl)}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}
              >
                {t('modern_pharmacy')}
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {config?.descriptionAbout || config?.messageAccueil || ''}
              </p>
              <ul className="space-y-4">
                {SERVICES.map((service) => (
                  <li key={service} className="flex items-start gap-3" style={{ color: 'var(--text-secondary)' }}>
                    <CheckCircle2 className="h-6 w-6 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-base">{service}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="rounded-3xl p-10 md:p-12 text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              <h3 className="text-2xl font-bold tracking-tight mb-8" style={{ fontFamily: 'var(--font-sans)' }}>
                {config?.nomPharmacien || 'Notre équipe'}
              </h3>
              <div className="space-y-6 text-white/90">
                {config?.adresse && (
                  <p className="flex items-start gap-4">
                    <MapPin className="h-6 w-6 shrink-0 mt-0.5" />
                    <span className="text-base">{config.adresse}</span>
                  </p>
                )}
                {config?.telephone && (
                  <p className="flex items-center gap-3">
                    <Phone className="h-5 w-5 shrink-0" />
                    <a href={`tel:${config.telephone}`} className="hover:text-white">{config.telephone}</a>
                  </p>
                )}
              </div>
              {config?.numeroAutorisation && (
                <p className="mt-8 pt-6 text-sm text-white/70" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                  N° d&apos;autorisation : {config.numeroAutorisation}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section Services & Garde ─── */}
      <section
        className="py-20 md:py-28"
        style={{ background: 'var(--surface-base)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2
              className="text-3xl md:text-4xl font-bold tracking-tight mb-3"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              {t('services_title')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t('services_subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES_VITRINE.map((svc) => (
              <div
                key={svc.titleKey}
                className="rounded-2xl p-7 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}
                >
                  <svc.icon className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t(svc.titleKey)}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t(svc.descKey)}
                </p>
              </div>
            ))}

            {/* Carte Garde */}
            <div
              className="rounded-2xl p-7 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
              }}
            >
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-white">
                {t('svc_garde')}
              </h3>
              <p className="text-sm leading-relaxed text-white/90 mb-4">
                {t('svc_garde_desc')}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                <span className="font-medium text-white">{t('garde_active')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section Équipe ─── */}
      <section
        className="py-20 md:py-28"
        style={{ background: 'var(--surface-raised)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2
              className="text-3xl md:text-4xl font-bold tracking-tight mb-3"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              {t('team_title')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t('team_subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Pharmacien titulaire */}
            <div
              className="rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-lg"
              style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}
              >
                <UserRound className="h-10 w-10" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                {config?.nomPharmacien || 'Pharmacien titulaire'}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t('team_pharmacist')}
              </p>
            </div>

            {/* Préparateur 1 */}
            <div
              className="rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-lg"
              style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'color-mix(in srgb, var(--color-secondary) 15%, transparent)' }}
              >
                <UserRound className="h-10 w-10" style={{ color: 'var(--color-secondary)' }} />
              </div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                {t('team_preparateur')}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {config?.nom || 'Équipe'}
              </p>
            </div>

            {/* Préparateur 2 */}
            <div
              className="rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-lg"
              style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'color-mix(in srgb, var(--color-info) 15%, transparent)' }}
              >
                <UserRound className="h-10 w-10" style={{ color: 'var(--color-info)' }} />
              </div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                {t('team_preparateur')}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {config?.nom || 'Équipe'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section Ordonnance rapide ─── */}
      {commandeActive && (
        <section
          className="py-20 md:py-28"
          style={{ background: 'var(--surface-base)' }}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2
                className="text-3xl md:text-4xl font-bold tracking-tight mb-3"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
              >
                {t('quick_rx_title')}
              </h2>
              <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
                {t('quick_rx_subtitle')}
              </p>
            </div>

            <div
              className="rounded-3xl p-8 md:p-10"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                className="relative rounded-2xl p-8 text-center cursor-pointer transition-colors mb-5"
                style={{
                  border: `2px dashed ${rxDragOver ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                  background: rxDragOver
                    ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)'
                    : 'var(--surface-base)',
                }}
                onDragOver={(e) => { e.preventDefault(); setRxDragOver(true); }}
                onDragLeave={() => setRxDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setRxDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) traiterFichier(file);
                }}
                onClick={() => rxInputRef.current?.click()}
              >
                <input
                  ref={rxInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && traiterFichier(e.target.files[0])}
                />
                {rxFile ? (
                  <div>
                    {rxApercu ? (
                      <img src={rxApercu} alt="Aperçu" className="max-h-40 mx-auto rounded-xl mb-3 object-contain" />
                    ) : (
                      <FileIcon className="h-14 w-14 mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
                    )}
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{rxFile.name}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {(rxFile.size / 1024).toFixed(0)} Ko — {t('quick_rx_formats')}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t('quick_rx_drag')}
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      {t('quick_rx_formats')}
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={envoyerOrdonnanceRapide}
                disabled={!rxFile || rxSending}
                className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:shadow-md"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {rxSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t('quick_rx_btn')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── Section FAQ ─── */}
      <section
        className="py-20 md:py-28"
        style={{ background: 'var(--surface-raised)' }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2
              className="text-3xl md:text-4xl font-bold tracking-tight mb-3"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              {t('faq_title')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t('faq_subtitle')}
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden transition-all"
                style={{
                  background: 'var(--surface-base)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="font-semibold text-sm md:text-base" style={{ color: 'var(--text-primary)' }}>
                    {t(item.q)}
                  </span>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 transition-transform duration-200"
                    style={{
                      color: 'var(--text-muted)',
                      transform: faqOpen === i ? 'rotate(180deg)' : 'none',
                    }}
                  />
                </button>
                {faqOpen === i && (
                  <div
                    className="px-5 pb-4 text-sm leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t(item.a)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="contact">
        <Footer />
      </div>

      <FloatingPrescriptionButton />
    </div>
  );
};

export default Home;
