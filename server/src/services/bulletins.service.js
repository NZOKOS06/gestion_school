import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { resolveCoefficient } from './matieresProgramme.service.js';

const MENTION_THRESHOLDS = [
  { min: 16, mention: 'felicitations' },
  { min: 14, mention: 'tableau_honneur' },
  { min: 12, mention: 'encouragements' },
  { min: 10, mention: 'aucune' },
  { min: 0, mention: 'avertissement_travail' },
];

export function mentionFromMoyenne(mg, seuilReussite = 10) {
  if (mg < seuilReussite) return 'avertissement_travail';
  for (const t of MENTION_THRESHOLDS) {
    if (mg >= t.min) return t.mention;
  }
  return 'aucune';
}

/**
 * Compute weighted averages for one eleve for a class/period.
 */
export async function computeEleveBulletin(tenantId, { eleveId, classeId, anneeScolaireId, periodeIndex, seuilReussite = 10 }) {
  const notes = await prisma.note.findMany({
    where: {
      tenantId,
      eleveId,
      evaluation: {
        classeId,
        anneeScolaireId,
        periodeIndex: parseInt(periodeIndex, 10),
      },
    },
    include: {
      evaluation: {
        include: {
          matiere: { select: { id: true, nom: true, code: true, coefficient: true } },
        },
      },
    },
  });

  const matieresMap = new Map();
  for (const note of notes) {
    const matiere = note.evaluation.matiere;
    const matiereId = note.evaluation.matiereId;
    if (!matieresMap.has(matiereId)) {
      matieresMap.set(matiereId, { matiere, weightedSum: 0, coefSum: 0, notes: [] });
    }
    const entry = matieresMap.get(matiereId);
    const max = Number(note.evaluation.noteMaximale) || 20;
    const normalized = (Number(note.valeur) / max) * 20;
    const coef = Number(note.evaluation.coefficient) || 1;
    entry.weightedSum += normalized * coef;
    entry.coefSum += coef;
    entry.notes.push({
      evaluation: note.evaluation.nom,
      valeur: Number(note.valeur),
      noteMaximale: max,
      coefficient: coef,
    });
  }

  const detailsMatieres = [];
  let totalPoints = 0;
  let totalCoef = 0;

  for (const entry of matieresMap.values()) {
    const moyenne = entry.coefSum > 0 ? entry.weightedSum / entry.coefSum : 0;
    const coef = await resolveCoefficient(tenantId, {
      classeId,
      matiereId: entry.matiere.id,
      anneeScolaireId,
    });
    totalPoints += moyenne * coef;
    totalCoef += coef;
    detailsMatieres.push({
      matiereId: entry.matiere.id,
      matiereNom: entry.matiere.nom,
      matiereCode: entry.matiere.code,
      moyenne: Math.round(moyenne * 100) / 100,
      coefficient: coef,
      notes: entry.notes,
    });
  }

  const moyenneGenerale = totalCoef > 0 ? Math.round((totalPoints / totalCoef) * 100) / 100 : 0;

  return {
    eleveId,
    moyenneGenerale,
    mention: mentionFromMoyenne(moyenneGenerale, seuilReussite),
    notesDetaillees: detailsMatieres,
    hasNotes: notes.length > 0,
  };
}

/**
 * Calculate class results with ranks (ex aequo).
 */
export async function calculerClasse(tenantId, { anneeScolaireId, classeId, periodeIndex }) {
  const config = await prisma.tenantConfig.findUnique({ where: { tenantId } });
  const seuil = Number(config?.seuilReussite ?? 10);

  const inscriptions = await prisma.inscription.findMany({
    where: { tenantId, classeId, anneeScolaireId, statut: 'validee' },
    include: {
      eleve: { select: { id: true, prenom: true, nom: true, matricule: true } },
    },
    orderBy: { eleve: { nom: 'asc' } },
  });

  const results = [];
  for (const insc of inscriptions) {
    const computed = await computeEleveBulletin(tenantId, {
      eleveId: insc.eleveId,
      classeId,
      anneeScolaireId,
      periodeIndex,
      seuilReussite: seuil,
    });
    results.push({
      eleveId: insc.eleve.id,
      elevePrenom: insc.eleve.prenom,
      eleveNom: insc.eleve.nom,
      matricule: insc.eleve.matricule,
      moyenneGenerale: computed.moyenneGenerale,
      mention: computed.mention,
      notesDetaillees: computed.notesDetaillees,
      hasNotes: computed.hasNotes,
    });
  }

  // Rank with ties (ex aequo): same moyenne → same rang
  const sorted = [...results].sort((a, b) => b.moyenneGenerale - a.moyenneGenerale);
  let lastMg = null;
  let lastRang = 0;
  sorted.forEach((r, idx) => {
    if (lastMg === null || r.moyenneGenerale < lastMg - 0.001) {
      lastRang = idx + 1;
      lastMg = r.moyenneGenerale;
    }
    r.rang = lastRang;
  });

  const byId = new Map(sorted.map((r) => [r.eleveId, r]));
  return results.map((r) => ({
    ...r,
    rang: byId.get(r.eleveId).rang,
    effectifClasse: results.length,
  }));
}

export function buildQrHash({ tenantId, eleveId, classeId, anneeScolaireId, periodeIndex }) {
  return crypto
    .createHash('sha256')
    .update(`${tenantId}|${eleveId}|${classeId}|${anneeScolaireId}|${periodeIndex}|${Date.now()}`)
    .digest('hex')
    .slice(0, 48);
}

export async function countAbsencesHeures(tenantId, eleveId, anneeScolaireId) {
  // Approximate: count absences as 2h each for the school year window
  const annee = await prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, tenantId } });
  if (!annee) return 0;
  const count = await prisma.absence.count({
    where: {
      tenantId,
      eleveId,
      dateAbsence: { gte: annee.dateDebut, lte: annee.dateFin },
      typeAbsence: 'absent',
    },
  });
  return count * 2;
}
