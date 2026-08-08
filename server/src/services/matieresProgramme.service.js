import { prisma } from '../utils/prisma.js';

/**
 * Résout le coefficient d'une matière pour une classe :
 * surcharge classe > programme niveau/année > catalogue.
 */
export async function resolveCoefficient(tenantId, { classeId, matiereId, anneeScolaireId, niveauOfficielId }) {
  let classe = null;
  if (classeId) {
    classe = await prisma.classe.findFirst({
      where: { id: classeId, tenantId },
      select: { id: true, anneeScolaireId: true, niveauOfficielId: true },
    });
  }
  const anneeId = anneeScolaireId || classe?.anneeScolaireId;
  const niveauId = niveauOfficielId || classe?.niveauOfficielId;

  if (classeId) {
    const override = await prisma.matiereClasseAnnee.findFirst({
      where: { tenantId, classeId, matiereId, actif: true },
    });
    if (override?.coefficient != null) return Number(override.coefficient);
  }

  if (anneeId && niveauId) {
    const prog = await prisma.matiereNiveauAnnee.findFirst({
      where: { tenantId, anneeScolaireId: anneeId, niveauOfficielId: niveauId, matiereId, actif: true },
    });
    if (prog) return Number(prog.coefficient);
  }

  const matiere = await prisma.matiere.findFirst({
    where: { id: matiereId, tenantId },
    select: { coefficient: true },
  });
  return Number(matiere?.coefficient || 1);
}

/**
 * Matières actives d'une classe = programme niveau + overrides classe actifs.
 */
export async function getMatieresForClasse(tenantId, classeId) {
  const classe = await prisma.classe.findFirst({
    where: { id: classeId, tenantId },
    select: { id: true, anneeScolaireId: true, niveauOfficielId: true },
  });
  if (!classe) return [];

  const byMatiere = new Map();

  if (classe.niveauOfficielId) {
    const prog = await prisma.matiereNiveauAnnee.findMany({
      where: {
        tenantId,
        anneeScolaireId: classe.anneeScolaireId,
        niveauOfficielId: classe.niveauOfficielId,
        actif: true,
      },
      include: { matiere: true },
    });
    for (const p of prog) {
      byMatiere.set(p.matiereId, {
        matiereId: p.matiereId,
        matiere: p.matiere,
        coefficient: Number(p.coefficient),
        source: 'niveau',
      });
    }
  }

  const overrides = await prisma.matiereClasseAnnee.findMany({
    where: { tenantId, classeId },
    include: { matiere: true },
  });
  for (const o of overrides) {
    if (!o.actif) {
      byMatiere.delete(o.matiereId);
      continue;
    }
    byMatiere.set(o.matiereId, {
      matiereId: o.matiereId,
      matiere: o.matiere,
      coefficient: o.coefficient != null ? Number(o.coefficient) : Number(o.matiere.coefficient),
      source: 'classe',
    });
  }

  return [...byMatiere.values()].sort((a, b) => (a.matiere.nom || '').localeCompare(b.matiere.nom || '', 'fr'));
}
