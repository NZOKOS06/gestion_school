import { prisma } from './prisma.js';

/**
 * Année scolaire opérationnelle (statut active / actif=true).
 * @returns {Promise<object|null>}
 */
export async function getAnneeOperationnelle(tenantId) {
  if (!tenantId) return null;
  const byStatut = await prisma.anneeScolaire.findFirst({
    where: { tenantId, statut: 'active' },
    orderBy: { dateDebut: 'desc' },
  });
  if (byStatut) return byStatut;
  return prisma.anneeScolaire.findFirst({
    where: { tenantId, actif: true },
    orderBy: { dateDebut: 'desc' },
  });
}

/**
 * Resolve anneeScolaireId for operational list endpoints.
 * Default = année active. Explicit anneeScolaireId allowed for archive consultation.
 */
export async function resolveAnneeScolaireId(tenantId, queryAnneeId) {
  if (queryAnneeId) return queryAnneeId;
  const active = await getAnneeOperationnelle(tenantId);
  return active?.id || null;
}
