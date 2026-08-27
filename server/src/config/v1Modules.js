/**
 * Gel produit V1 — cœur métier avant expansion.
 *
 * Cœur : Élèves → Classes → Inscriptions → Paiements → Notes/Bulletins → Personnel → Rapports
 * Hors gel (OFF par défaut / plans pro+) : EDT, absences, parents, sanctions, certificats, cantine…
 *
 * DoD V1 : module utilisé 2 semaines par une école pilote avant activation large.
 */

/** Toujours forcés ON (ne pas désactiver). */
export const CRITICAL_MODULES = [
  'moduleEleves',
  'moduleClasses',
  'moduleInscriptions',
  'modulePaiements',
];

/** Modules du gel V1 (plan basique = cible go-to-market). */
export const V1_CORE_MODULES = [
  ...CRITICAL_MODULES,
  'moduleNotes',
  'moduleBulletins',
  'modulePersonnel',
  'moduleRapports',
];

/** Explicitement hors V1 — ne pas activer par défaut sur nouveaux tenants. */
export const V1_FROZEN_OFF = [
  'moduleEmploiDuTemps',
  'modulePresences',
  'moduleParents',
  'moduleSanctions',
  'moduleCertificats',
  'moduleBiblio',
  'moduleCantine',
  'moduleTransport',
  'modulePointagePersonnel',
  'modulePaie',
];

/**
 * Modules autorisés par plan commercial.
 * `basique` = surface V1 gelée.
 */
export const MODULES_BY_PLAN = {
  starter: [...CRITICAL_MODULES],
  basique: [...V1_CORE_MODULES],
  pro: [
    ...V1_CORE_MODULES,
    'moduleEmploiDuTemps',
    'modulePresences',
    'moduleParents',
    'modulePointagePersonnel',
    'modulePaie',
  ],
  enterprise: [
    ...V1_CORE_MODULES,
    'moduleEmploiDuTemps',
    'modulePresences',
    'moduleParents',
    'moduleSanctions',
    'moduleCertificats',
    'modulePointagePersonnel',
    'modulePaie',
  ],
};

/** Valeurs booléennes pour create TenantConfig (hors démo showcase). */
export function moduleFlagsForPlan(plan = 'basique') {
  const allowed = new Set(MODULES_BY_PLAN[plan] || MODULES_BY_PLAN.basique);
  const all = new Set([...V1_CORE_MODULES, ...V1_FROZEN_OFF]);
  const flags = {};
  for (const key of all) {
    flags[key] = allowed.has(key);
  }
  for (const key of CRITICAL_MODULES) {
    flags[key] = true;
  }
  return flags;
}

export function enforceModuleConstraints(configData, tenantPlan) {
  const data = { ...configData };
  for (const m of CRITICAL_MODULES) {
    data[m] = true;
  }
  const allowed = new Set(MODULES_BY_PLAN[tenantPlan] || MODULES_BY_PLAN.basique);
  for (const key of Object.keys(data)) {
    if (key.startsWith('module') && !allowed.has(key)) {
      data[key] = false;
    }
  }
  // Désactiver explicitement les hors-plan même absents du payload
  for (const key of [...V1_CORE_MODULES, ...V1_FROZEN_OFF]) {
    if (!allowed.has(key) && !CRITICAL_MODULES.includes(key)) {
      data[key] = false;
    }
  }
  return data;
}
