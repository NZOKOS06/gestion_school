import {
  LayoutDashboard,
  GraduationCap,
  School,
  ClipboardList,
  BookOpen,
  CalendarDays,
  CalendarX,
  Gavel,
  Wallet,
  FileText,
  Award,
  BarChart3,
  Users,
  Settings,
  NotebookPen,
  Users2,
  DoorOpen,
  CalendarRange,
  Mail,
  ClipboardEdit,
  CalendarCheck,
  UserRound,
} from 'lucide-react';

export const ADMIN_ROUTE_LABELS = {
  '/admin/dashboard': 'Tableau de bord',
  '/admin/eleves': 'Élèves',
  '/admin/classes': 'Classes & Niveaux',
  '/admin/inscriptions': 'Inscriptions',
  '/admin/matieres': 'Matières',
  '/admin/enseignants': 'Enseignants',
  '/admin/emploi-du-temps': 'Emploi du temps',
  '/admin/absences': 'Absences',
  '/admin/sanctions': 'Sanctions',
  '/admin/paiements': 'Paiements & Échéances',
  '/admin/bulletins': 'Résultats et Bulletin',
  '/admin/certificats': 'Certificats',
  '/admin/cahier-de-textes': 'Cahier de textes',
  '/admin/conseil-de-classe': 'Conseil de classe',
  '/admin/salles': 'Salles',
  '/admin/calendrier': 'Calendrier scolaire',
  '/admin/annees-scolaires': 'Années & périodes',
  '/admin/examens': 'Examens nationaux',
  '/admin/messagerie': 'Messagerie',
  '/admin/rapports': 'Rapports',
  '/admin/personnel': 'Personnel',
  '/admin/configuration': 'Configuration',
  '/admin/profil': 'Profil',
};

export const ADMIN_NAV = [
  {
    groupKey: 'pilotage',
    items: [
      { path: '/admin/dashboard', icon: LayoutDashboard, labelKey: 'dashboard', roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
      { path: '/admin/calendrier', icon: CalendarRange, labelKey: 'calendrier_scolaire', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/annees-scolaires', icon: CalendarDays, labelKey: 'annees_scolaires', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
    ],
  },
  {
    groupKey: 'vie_scolaire',
    items: [
      { path: '/admin/eleves', icon: GraduationCap, labelKey: 'eleves', roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
      { path: '/admin/classes', icon: School, labelKey: 'classes', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/inscriptions', icon: ClipboardList, labelKey: 'inscriptions', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/matieres', icon: BookOpen, labelKey: 'matieres', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/enseignants', icon: UserRound, labelKey: 'enseignants', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/emploi-du-temps', icon: CalendarDays, labelKey: 'emploi_du_temps', roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
      { path: '/admin/salles', icon: DoorOpen, labelKey: 'salles', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/absences', icon: CalendarX, labelKey: 'absences', module: 'presences', roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
      { path: '/admin/sanctions', icon: Gavel, labelKey: 'sanctions', module: 'sanctions', roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
    ],
  },
  {
    groupKey: 'pedagogie',
    items: [
      { path: '/admin/cahier-de-textes', icon: NotebookPen, labelKey: 'cahier_de_textes', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/conseil-de-classe', icon: Users2, labelKey: 'conseil_de_classe', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/bulletins', icon: FileText, labelKey: 'resultats_bulletins', module: 'bulletins', roles: ['directeur', 'directeur_etudes'] },
      { path: '/admin/examens', icon: Award, labelKey: 'examens', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/certificats', icon: Award, labelKey: 'certificats', module: 'certificats', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
    ],
  },
  {
    groupKey: 'finances',
    items: [
      { path: '/admin/paiements', icon: Wallet, labelKey: 'paiements', module: 'paiements', roles: ['directeur'] },
    ],
  },
  {
    groupKey: 'analyse',
    items: [
      { path: '/admin/rapports', icon: BarChart3, labelKey: 'rapports', roles: ['directeur'] },
      { path: '/admin/personnel', icon: Users, labelKey: 'personnel', roles: ['directeur'] },
    ],
  },
  {
    groupKey: 'communication',
    items: [
      { path: '/admin/messagerie', icon: Mail, labelKey: 'messagerie', roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
    ],
  },
  {
    groupKey: 'systeme',
    items: [
      { path: '/admin/configuration', icon: Settings, labelKey: 'configuration', roles: ['directeur'] },
    ],
  },
];

export const ROLE_DISPLAY_LABELS = {
  super_admin: 'Super Admin',
  directeur: 'Directeur',
  directeur_etudes: 'Directeur des études',
  secretaire: 'Secrétaire',
  enseignant: 'Enseignant',
  surveillant: 'Surveillant',
  comptable: 'Gestionnaire',
  parent: 'Parent',
};

export const ENSEIGNANT_NAV = [
  {
    groupKey: 'espace_enseignant',
    items: [
      { path: '/enseignant/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
      { path: '/enseignant/mes-classes', icon: School, labelKey: 'mes_classes' },
      { path: '/enseignant/saisie-notes', icon: ClipboardEdit, labelKey: 'saisie_notes' },
      { path: '/enseignant/appel', icon: CalendarCheck, labelKey: 'faire_appel' },
      { path: '/enseignant/mon-emploi', icon: CalendarDays, labelKey: 'mon_emploi' },
      { path: '/enseignant/cahier-de-textes', icon: NotebookPen, labelKey: 'cahier_de_textes' },
      { path: '/enseignant/messagerie', icon: Mail, labelKey: 'messagerie' },
    ],
  },
];

export const ENSEIGNANT_ROUTE_LABELS = {
  '/enseignant/dashboard': 'Tableau de bord',
  '/enseignant/mes-classes': 'Mes classes',
  '/enseignant/saisie-notes': 'Saisie des notes',
  '/enseignant/appel': "Faire l'appel",
  '/enseignant/mon-emploi': 'Mon emploi du temps',
  '/enseignant/cahier-de-textes': 'Cahier de textes',
  '/enseignant/messagerie': 'Messagerie',
};

export const PARENT_NAV = [
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

export const PARENT_ROUTE_LABELS = {
  '/parent/dashboard': 'Tableau de bord',
  '/parent/mes-enfants': 'Mes enfants',
  '/parent/bulletins': 'Bulletins',
  '/parent/absences': 'Absences',
  '/parent/sanctions': 'Sanctions',
  '/parent/facturation': 'Facturation',
  '/parent/messagerie': 'Messagerie',
};

export const CAISSIER_NAV = [
  {
    groupKey: 'espace_caissier',
    items: [
      { path: '/caissier', icon: Wallet, labelKey: 'paiements' },
      { path: '/caissier/retards', icon: CalendarX, labelKey: 'retards' },
      { path: '/caissier/historique', icon: FileText, labelKey: 'historique' },
    ],
  },
];

export const CAISSIER_ROUTE_LABELS = {
  '/caissier': 'Paiements',
  '/caissier/retards': 'Retards',
  '/caissier/historique': 'Historique',
};

export function buildBreadcrumbs(pathname, routeLabels, homePath, homeLabel = 'GestSchool') {
  const pageLabel = routeLabels[pathname];
  if (!pageLabel) {
    const segments = pathname.split('/').filter(Boolean);
    return [
      { label: homeLabel, path: homePath },
      { label: segments[segments.length - 1] || 'Page', isPrimary: true },
    ];
  }
  return [
    { label: homeLabel, path: homePath },
    { label: pageLabel, isPrimary: true },
  ];
}

/** Flat list of navigable pages for command palette */
export function flattenNav(navGroups) {
  return navGroups.flatMap((g) =>
    g.items.map((item) => ({
      path: item.path,
      labelKey: item.labelKey,
      icon: item.icon,
      module: item.module,
      roles: item.roles,
    }))
  );
}
