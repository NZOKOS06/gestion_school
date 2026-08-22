/**
 * Règles année scolaire opérationnelle (une seule active par tenant).
 */

/** Sync booléen legacy `actif` depuis `statut`. */
export function syncActifFromStatut(statut) {
  return statut === 'active';
}

/**
 * Active `activeId` et désactive les autres sans archiver les brouillons.
 * - Années concurrentes en statut `active` → `archivee` + actif false
 * - Autres années avec actif=true (legacy) → actif false, statut inchangé
 * - Met à jour TenantConfig.anneeScolaireActiveId si possible
 *
 * @param {import('@prisma/client').Prisma.TransactionClient | import('@prisma/client').PrismaClient} tx
 */
export async function ensureSingleActiveYear(tx, tenantId, activeId) {
  if (!tenantId || !activeId) {
    throw new Error('tenantId et activeId requis');
  }

  const target = await tx.anneeScolaire.findFirst({
    where: { id: activeId, tenantId },
  });
  if (!target) {
    throw new Error('ANNEE_NOT_FOUND');
  }

  await tx.anneeScolaire.updateMany({
    where: { tenantId, id: { not: activeId }, statut: 'active' },
    data: { actif: false, statut: 'archivee' },
  });

  await tx.anneeScolaire.updateMany({
    where: { tenantId, id: { not: activeId }, actif: true },
    data: { actif: false },
  });

  const annee = await tx.anneeScolaire.update({
    where: { id: activeId },
    data: { actif: true, statut: 'active' },
  });

  try {
    await tx.tenantConfig.update({
      where: { tenantId },
      data: { anneeScolaireActiveId: activeId },
    });
  } catch {
    // Tenant sans config — non bloquant
  }

  return annee;
}

/** Nombre d'années marquées actives (statut ou flag) — assertions / smoke. */
export async function countActiveYears(tx, tenantId) {
  return tx.anneeScolaire.count({
    where: {
      tenantId,
      OR: [{ statut: 'active' }, { actif: true }],
    },
  });
}
