export const CYCLES_ENSEIGNEMENT = ['prescolaire', 'primaire', 'college', 'lycee'];

export const CYCLE_LABELS = {
  prescolaire: 'Préscolaire',
  primaire: 'Primaire',
  college: 'Collège',
  lycee: 'Lycée',
};

/** null / vide = tous les cycles */
export function resolveAllowedCycles(concerneCycles) {
  if (!concerneCycles?.length) return CYCLES_ENSEIGNEMENT;
  return CYCLES_ENSEIGNEMENT.filter((c) => concerneCycles.includes(c));
}

export function isCycleAllowed(cycle, concerneCycles) {
  if (!concerneCycles?.length) return true;
  return concerneCycles.includes(cycle);
}
