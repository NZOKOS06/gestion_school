/** Cycles d'enseignement — filtrage par établissement (TenantConfig.concerneCycles). */

export const ALL_CYCLES = ['prescolaire', 'primaire', 'college', 'lycee'];

export const CYCLE_LABELS = {
  prescolaire: 'Préscolaire',
  primaire: 'Primaire',
  college: 'Collège',
  lycee: 'Lycée',
};

/** null = tous les cycles (legacy / non configuré). */
export function resolveTenantCycles(concerneCycles) {
  if (!concerneCycles || !Array.isArray(concerneCycles) || !concerneCycles.length) {
    return null;
  }
  const filtered = concerneCycles.filter((c) => ALL_CYCLES.includes(c));
  return filtered.length ? filtered : null;
}

export function isCycleAllowed(cycle, concerneCycles) {
  const allowed = resolveTenantCycles(concerneCycles);
  if (!allowed) return true;
  return allowed.includes(cycle);
}

export function filterByTenantCycles(items, concerneCycles, getCycle) {
  const allowed = resolveTenantCycles(concerneCycles);
  if (!allowed) return items;
  return items.filter((item) => allowed.includes(getCycle(item)));
}

export async function getTenantCyclesConfig(tenantId, prismaClient) {
  const cfg = await prismaClient.tenantConfig.findUnique({
    where: { tenantId },
    select: { concerneCycles: true },
  });
  return cfg?.concerneCycles ?? null;
}
