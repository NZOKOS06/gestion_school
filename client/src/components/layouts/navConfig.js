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
  TrendingDown,
  Clock,
  Timer,
  Banknote,
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
  '/admin/pointage': 'Pointage personnel',
  '/admin/heures-enseignees': 'Validation des heures',
  '/admin/paie': 'Paie du personnel',
  '/admin/configuration': 'Configuration',
  '/admin/profil': 'Profil',
};

export const ADMIN_NAV = [
  {
    groupKey: 'pilotage',
    items: [
      { path: '/admin/dashboard', icon: LayoutDashboard, labelKey: 'dashboard', primary: true, roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
      { path: '/admin/calendrier', icon: CalendarRange, labelKey: 'calendrier_scolaire', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/annees-scolaires', icon: CalendarDays, labelKey: 'annees_scolaires', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
    ],
  },
  {
    groupKey: 'vie_scolaire',
    label: 'Vie Scolaire',
    items: [
      { path: '/admin/eleves', icon: GraduationCap, labelKey: 'eleves', primary: true, roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
      { path: '/admin/classes', icon: School, labelKey: 'classes', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/inscriptions', icon: ClipboardList, labelKey: 'inscriptions', primary: true, roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/matieres', icon: BookOpen, labelKey: 'matieres', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/enseignants', icon: UserRound, labelKey: 'enseignants', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/emploi-du-temps', icon: CalendarDays, labelKey: 'emploi_du_temps', roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
      { path: '/admin/salles', icon: DoorOpen, labelKey: 'salles', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/absences', icon: CalendarX, labelKey: 'absences', module: 'presences', roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
      { path: '/admin/pointage', icon: Clock, labelKey: 'pointage_personnel', module: 'pointagePersonnel', roles: ['directeur', 'directeur_etudes', 'surveillant'] },
      { path: '/admin/sanctions', icon: Gavel, labelKey: 'sanctions', module: 'sanctions', roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
    ],
  },
  {
    groupKey: 'pedagogie',
    label: 'Pédagogie',
    items: [
      { path: '/admin/cahier-de-textes', icon: NotebookPen, labelKey: 'cahier_de_textes', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/conseil-de-classe', icon: Users2, labelKey: 'conseil_de_classe', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/bulletins', icon: FileText, labelKey: 'resultats_bulletins', module: 'bulletins', roles: ['directeur', 'directeur_etudes'] },
      { path: '/admin/heures-enseignees', icon: Timer, labelKey: 'heures_enseignees', module: 'pointagePersonnel', roles: ['directeur', 'directeur_etudes'] },
      { path: '/admin/examens', icon: Award, labelKey: 'examens', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
      { path: '/admin/certificats', icon: Award, labelKey: 'certificats', module: 'certificats', roles: ['directeur', 'directeur_etudes', 'secretaire'] },
    ],
  },
  {
    groupKey: 'finances',
    items: [
      { path: '/admin/paiements', icon: Wallet, labelKey: 'paiements', module: 'paiements', primary: true, roles: ['directeur'] },
      { path: '/admin/paie', icon: Banknote, labelKey: 'paie_personnel', module: 'paie', roles: ['directeur', 'comptable'] },
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
      { path: '/admin/messagerie', icon: Mail, labelKey: 'messagerie', primary: true, roles: ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'] },
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
      { path: '/enseignant/dashboard', icon: LayoutDashboard, labelKey: 'dashboard', primary: true },
      { path: '/enseignant/mes-classes', icon: School, labelKey: 'mes_classes', primary: true },
      { path: '/enseignant/saisie-notes', icon: ClipboardEdit, labelKey: 'saisie_notes', primary: true },
      { path: '/enseignant/appel', icon: CalendarCheck, labelKey: 'faire_appel', primary: true },
      { path: '/enseignant/mon-emploi', icon: CalendarDays, labelKey: 'mon_emploi' },
      { path: '/enseignant/mes-pointages', icon: Clock, labelKey: 'mes_pointages', module: 'pointagePersonnel' },
      { path: '/enseignant/cahier-de-textes', icon: NotebookPen, labelKey: 'cahier_de_textes' },
      { path: '/enseignant/messagerie', icon: Mail, labelKey: 'messagerie', primary: true },
    ],
  },
];

export const ENSEIGNANT_ROUTE_LABELS = {
  '/enseignant/dashboard': 'Tableau de bord',
  '/enseignant/mes-classes': 'Mes classes',
  '/enseignant/saisie-notes': 'Saisie des notes',
  '/enseignant/appel': "Faire l'appel",
  '/enseignant/mon-emploi': 'Mon emploi du temps',
  '/enseignant/mes-pointages': 'Mes pointages',
  '/enseignant/cahier-de-textes': 'Cahier de textes',
  '/enseignant/messagerie': 'Messagerie',
};

export const PARENT_NAV = [
  {
    groupKey: 'espace_parent',
    items: [
      { path: '/parent/dashboard', icon: LayoutDashboard, labelKey: 'dashboard', primary: true },
      { path: '/parent/mes-enfants', icon: Users, labelKey: 'mes_enfants', primary: true },
      { path: '/parent/bulletins', icon: FileText, labelKey: 'bulletins', primary: true },
      { path: '/parent/absences', icon: CalendarX, labelKey: 'absences' },
      { path: '/parent/sanctions', icon: Gavel, labelKey: 'sanctions' },
      { path: '/parent/facturation', icon: Wallet, labelKey: 'facturation', primary: true },
      { path: '/parent/messagerie', icon: Mail, labelKey: 'messagerie', primary: true },
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
    groupKey: 'espace_gestionnaire',
    items: [
      { path: '/caissier', icon: LayoutDashboard, labelKey: 'dashboard', primary: true },
      { path: '/caissier/eleves', icon: GraduationCap, labelKey: 'eleves_finances', primary: true },
      { path: '/caissier/historique', icon: Wallet, labelKey: 'caisse', primary: true },
      { path: '/caissier/depenses', icon: TrendingDown, labelKey: 'depenses', primary: true },
      { path: '/caissier/rapports', icon: BarChart3, labelKey: 'rapports', primary: true },
    ],
  },
];

export const CAISSIER_ROUTE_LABELS = {
  '/caissier': 'Tableau de bord',
  '/caissier/eleves': 'Élèves (Finances)',
  '/caissier/historique': 'Journal de caisse',
  '/caissier/retards': 'Retards',
  '/caissier/encaisser': 'Encaisser',
  '/caissier/depenses': 'Dépenses',
  '/caissier/rapports': 'Rapports',
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
