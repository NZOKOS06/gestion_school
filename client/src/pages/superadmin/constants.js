import {
  Building2, Users, ShoppingCart, GraduationCap, BookOpen, FileText,
  BarChart2, Award, AlertTriangle, Globe, Calendar, ClipboardList,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION & CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

export const PLANS = {
  starter:    { label: 'Starter',    color: 'neutral' },
  basique:    { label: 'Basique',    color: 'info'    },
  pro:        { label: 'Pro',        color: 'warning' },
  enterprise: { label: 'Enterprise', color: 'success' },
};

export const PALETTES = [
  { id: 'emeraude',  label: 'Émeraude Scolaire', primary: '#16A34A', second: '#15803D', texte: '#FFFFFF' },
  { id: 'academique',label: 'Bleu Académique',   primary: '#2563EB', second: '#1D4ED8', texte: '#FFFFFF' },
  { id: 'ardoise',   label: 'Ardoise Pro',       primary: '#0F172A', second: '#1E293B', texte: '#FFFFFF' },
  { id: 'prestige',  label: 'Or Prestige',       primary: '#B45309', second: '#92400E', texte: '#FFFFFF' },
  { id: 'congo',     label: 'Congo Vert',        primary: '#15803D', second: '#166534', texte: '#FFFFFF' },
  { id: 'nuit',      label: 'Nuit Pro',          primary: '#1E1B4B', second: '#312E81', texte: '#FFFFFF' },
];

export const MODULES_CONFIG = [
  { key: 'moduleEleves',          label: 'Élèves',          icon: GraduationCap,  desc: 'Inscriptions et dossiers élèves', locked: true,  planMinimum: 'starter',     required: true },
  { key: 'moduleClasses',         label: 'Classes',         icon: Building2,      desc: 'Classes, niveaux et cycles',      locked: true,  planMinimum: 'starter',     required: true },
  { key: 'modulePaiements',       label: 'Paiements',       icon: ShoppingCart,   desc: 'Scolarités et échéances',         locked: true,  planMinimum: 'starter',     required: true },
  { key: 'moduleMatieres',        label: 'Matières',        icon: BookOpen,       desc: 'Matières et coefficients',        locked: false, planMinimum: 'basique',     required: false },
  { key: 'moduleNotes',           label: 'Notes & Bulletins', icon: FileText,     desc: 'Saisie des notes et bulletins',   locked: false, planMinimum: 'basique',     required: false },
  { key: 'modulePersonnel',       label: 'Personnel',       icon: Users,          desc: 'Comptes et rôles',                locked: false, planMinimum: 'basique',     required: false },
  { key: 'moduleRapports',        label: 'Rapports',        icon: BarChart2,      desc: 'Statistiques',                    locked: false, planMinimum: 'pro',         required: false },
  { key: 'moduleEmploiDuTemps',   label: 'Emploi du temps', icon: Calendar,       desc: 'Planification des cours',         locked: false, planMinimum: 'pro',         required: false },
  { key: 'moduleAbsences',        label: 'Absences',        icon: ClipboardList,  desc: 'Appel et suivi des absences',     locked: false, planMinimum: 'pro',         required: false },
  { key: 'moduleActualites',      label: 'Actualités',      icon: Globe,          desc: 'Publications et communication',   locked: false, planMinimum: 'pro',         required: false },
  { key: 'moduleSanctions',       label: 'Sanctions',       icon: AlertTriangle,  desc: 'Discipline et sanctions',         locked: false, planMinimum: 'enterprise',  required: false },
  { key: 'moduleCertificats',     label: 'Certificats',     icon: Award,          desc: 'Attestations et certificats',     locked: false, planMinimum: 'enterprise',  required: false },
];

export const PLAN_ORDER = { starter: 1, basique: 2, pro: 3, enterprise: 4 };
export const isModuleAvailableForPlan = (modulePlan, tenantPlan) => (PLAN_ORDER[modulePlan] || 99) <= (PLAN_ORDER[tenantPlan] || 99);

export const FONTS = [
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'DM Sans', label: 'DM Sans' },
];

export const DEVISES = ['FCFA', 'XOF', 'USD', 'EUR', 'CDF'];

export const DEFAULT_CONFIG = {
  nomApp: '',
  nom: '',
  messageAccueil: '',
  sloganApp: '',
  descriptionAbout: '',
  anneeCreation: null,
  rccm: '',
  adresse: '',
  telephone: '',
  email: '',
  numeroAutorisation: '',
  numeroTVA: '',
  nomDirecteur: '',
  horaireOuverture: {},
  facebookUrl: '',
  instagramUrl: '',
  whatsappUrl: '',
  telegramUrl: '',
  googleMapsUrl: '',
  latitude: '',
  longitude: '',
  logoUrl: null,
  footerLogoUrl: null,
  faviconUrl: null,
  pwaIconUrl: null,
  backgroundImageUrl: null,
  heroImageUrl: null,
  featuresImageUrl: null,
  aboutImageUrl: null,
  heroVideoUrl: null,
  featuresVideoUrl: null,
  aboutVideoUrl: null,
  ogImageUrl: null,
  loaderUrl: null,
  couleurPrimaire: '#16A34A',
  couleurSecondaire: '#15803D',
  couleurTexte: '#FFFFFF',
  couleurAlerte: '#F59E0B',
  couleurErreur: '#EF4444',
  couleurSucces: '#22C55E',
  darkModeDefault: false,
  police: 'Plus Jakarta Sans',
  devise: 'FCFA',
  modePrix: 'TTC',
  tauxTVA: 0,
  anneeScolaire: '',
  modesPaiement: ['especes', 'mobile_money'],
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  emailAlertes: '',
  dureeSessionMinutes: 480,
  ipWhitelist: [],
  forcer2FA: false,
  privacyPolicyUrl: '',
  termsOfServiceUrl: '',
  cookiePolicyUrl: '',
  cookieBannerText: '',
  cookieBannerEnabled: true,
  analyticsEnabled: false,
  moduleEleves: true,
  moduleClasses: true,
  modulePaiements: true,
  moduleMatieres: false,
  moduleNotes: false,
  modulePersonnel: false,
  moduleRapports: true,
  moduleEmploiDuTemps: false,
  moduleAbsences: false,
  moduleActualites: false,
  moduleSanctions: false,
  moduleCertificats: false,
};

export const JOURS_SEMAINE_CONFIG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export const SUPERADMIN_TABS = ['dashboard', 'etablissements', 'creation', 'audit'];

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

export function generateSlug(nom) {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getInitials(nom) {
  return nom
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function countActiveModules(config) {
  return MODULES_CONFIG.filter(m => config?.[m.key]).length;
}

export function formatCurrency(value, devise = 'FCFA') {
  if (value == null) return '—';
  return new Intl.NumberFormat('fr-FR').format(value) + ' ' + devise;
}

export function buildTenantUrl(tenant) {
  // Priorité 1 : URL de production Vercel (VITE_API_URL → on en dérive le frontend)
  const prodBase = import.meta.env.VITE_FRONTEND_URL
    || (import.meta.env.VITE_API_URL
          ? import.meta.env.VITE_API_URL.replace('-api.onrender.com', '-two.vercel.app').replace(/\/api.*$/, '')
          : null);
  const isSubdomain = import.meta.env.VITE_SUBDOMAIN_MODE === 'true';
  if (prodBase && isSubdomain) {
    const host = new URL(prodBase).hostname;
    const parts = host.split('.');
    if (parts.length >= 2) {
      const domain = parts.slice(-2).join('.');
      return `https://${tenant.slug}.${domain}/login`;
    }
  }
  if (prodBase) return `${prodBase}/login?tenant=${tenant.slug}`;
  // Fallback : origine courante
  return `${window.location.origin}/login?tenant=${tenant.slug}`;
}

export function tabFromPathname(pathname) {
  const segment = pathname.replace(/^\/super-admin\/?/, '').split('/')[0];
  return SUPERADMIN_TABS.includes(segment) ? segment : 'dashboard';
}
