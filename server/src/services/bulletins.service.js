import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { resolveCoefficient, getMatieresForClasse } from './matieresProgramme.service.js';

/**
 * Calcul des bulletins.
 *
 * - Les notes sont ramenées à la notation de l'école (sur 20 ou sur 100).
 * - Moyenne d'une matière : au choix de l'école, soit pondérée par les coefficients des
 *   évaluations, soit « devoirs + composition » (poids des devoirs réglable, ex. 50 %).
 * - Moyenne générale : moyennes de matières × coefficient de la matière (classe > niveau >
 *   catalogue). Une matière sans note pour l'élève est « non classée » : exclue du calcul.
 * - Rangs avec ex aequo, en général et par matière ; moyennes de classe (moyenne, plus forte,
 *   plus faible).
 */

// Seuils de mention exprimés sur 20 (mis à l'échelle selon la notation de l'école)
const MENTION_THRESHOLDS = [
  { min: 16, mention: 'felicitations' },
  { min: 14, mention: 'tableau_honneur' },
  { min: 12, mention: 'encouragements' },
];

const TYPES_COMPOSITION = new Set(['examen']);

const r2 = (n) => Math.round(n * 100) / 100;

export function mentionFromMoyenne(mg, seuilReussite = 10, notationSur = 20) {
  const facteur = 20 / (Number(notationSur) || 20);
  const sur20 = Number(mg) * facteur;
  if (Number(mg) < Number(seuilReussite)) return 'avertissement_travail';
  for (const t of MENTION_THRESHOLDS) {
    if (sur20 >= t.min) return t.mention;
  }
  return 'aucune';
}

/**
 * Moyenne d'une matière pour un élève.
 * notes : [{ valeur, noteMaximale, coefficient, type }]
 * Retourne la moyenne sur `notationSur`, ou null s'il n'y a aucune note.
 */
export function moyenneMatiere(notes = [], { ponderation = 'coefficients', poidsDevoirs = 50, notationSur = 20 } = {}) {
  if (!notes.length) return null;
  const normalise = (n) => (Number(n.valeur) / (Number(n.noteMaximale) || 20)) * notationSur;
  const moyennePonderee = (liste) => {
    let somme = 0;
    let coefs = 0;
    for (const n of liste) {
      const coef = Number(n.coefficient) || 1;
      somme += normalise(n) * coef;
      coefs += coef;
    }
    return coefs > 0 ? somme / coefs : null;
  };

  if (ponderation === 'devoirs_composition') {
    const compositions = notes.filter((n) => TYPES_COMPOSITION.has(n.type));
    const devoirs = notes.filter((n) => !TYPES_COMPOSITION.has(n.type));
    const mDevoirs = moyennePonderee(devoirs);
    const mComposition = moyennePonderee(compositions);
    if (mDevoirs !== null && mComposition !== null) {
      const poids = Math.min(100, Math.max(0, Number(poidsDevoirs))) / 100;
      return mDevoirs * poids + mComposition * (1 - poids);
    }
    return mDevoirs ?? mComposition;
  }
  return moyennePonderee(notes);
}

/** Rangs avec ex aequo (même valeur = même rang), du plus grand au plus petit. */
export function rangsAvecExAequo(valeurs = []) {
  const tries = [...valeurs].sort((a, b) => b.valeur - a.valeur);
  const rangs = new Map();
  let dernier = null;
  let rangCourant = 0;
  tries.forEach((v, idx) => {
    if (dernier === null || v.valeur < dernier - 0.001) {
      rangCourant = idx + 1;
      dernier = v.valeur;
    }
    rangs.set(v.id, rangCourant);
  });
  return rangs;
}

/**
 * Cœur du calcul, sans accès base de données.
 * eleves : [{ id, ... }] ; matieres : [{ matiereId, nom, code, coefficient }]
 * notes : [{ eleveId, matiereId, valeur, noteMaximale, coefficient, type, appreciation, date }]
 * config : { notationSur, seuilReussite, ponderation, poidsDevoirs }
 */
export function calculerResultatsClasse({ eleves = [], matieres = [], notes = [], config = {} }) {
  const notationSur = Number(config.notationSur) || 20;
  const seuil = Number(config.seuilReussite ?? 10);
  const options = { ponderation: config.ponderation, poidsDevoirs: config.poidsDevoirs, notationSur };

  const notesParEleveMatiere = new Map();
  for (const n of notes) {
    const key = `${n.eleveId}|${n.matiereId}`;
    if (!notesParEleveMatiere.has(key)) notesParEleveMatiere.set(key, []);
    notesParEleveMatiere.get(key).push(n);
  }

  // 1. Moyennes par élève et par matière
  const resultats = eleves.map((eleve) => {
    const details = matieres.map((m) => {
      const notesMatiere = notesParEleveMatiere.get(`${eleve.id}|${m.matiereId}`) || [];
      const moyenne = moyenneMatiere(notesMatiere, options);
      const commentee = [...notesMatiere]
        .filter((n) => String(n.appreciation || '').trim())
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
      return {
        matiereId: m.matiereId,
        matiereNom: m.nom,
        matiereCode: m.code,
        coefficient: Number(m.coefficient) || 1,
        nonClasse: moyenne === null,
        moyenne: moyenne === null ? 0 : r2(moyenne),
        appreciation: commentee ? String(commentee.appreciation).trim() : null,
        notes: notesMatiere.map((n) => ({
          evaluation: n.evaluationNom,
          type: n.type,
          valeur: Number(n.valeur),
          noteMaximale: Number(n.noteMaximale) || 20,
          coefficient: Number(n.coefficient) || 1,
        })),
      };
    });
    return { eleve, details };
  });

  // 2. Statistiques et rang par matière (élèves classés uniquement)
  for (const m of matieres) {
    const classes = resultats
      .map((r) => ({ id: r.eleve.id, d: r.details.find((x) => x.matiereId === m.matiereId) }))
      .filter((x) => x.d && !x.d.nonClasse);
    if (!classes.length) continue;
    const valeurs = classes.map((x) => x.d.moyenne);
    const moyenneClasse = r2(valeurs.reduce((a, b) => a + b, 0) / valeurs.length);
    const rangs = rangsAvecExAequo(classes.map((x) => ({ id: x.id, valeur: x.d.moyenne })));
    for (const x of classes) {
      x.d.rangMatiere = rangs.get(x.id);
      x.d.moyenneClasse = moyenneClasse;
      x.d.moyenneMin = Math.min(...valeurs);
      x.d.moyenneMax = Math.max(...valeurs);
    }
  }

  // 3. Moyenne générale (matières classées, pondérées par le coefficient de la matière)
  const lignes = resultats.map(({ eleve, details }) => {
    const classees = details.filter((d) => !d.nonClasse);
    const totalCoef = classees.reduce((s, d) => s + d.coefficient, 0);
    const totalPoints = classees.reduce((s, d) => s + d.moyenne * d.coefficient, 0);
    const moyenneGenerale = totalCoef > 0 ? r2(totalPoints / totalCoef) : 0;
    return {
      eleveId: eleve.id,
      elevePrenom: eleve.prenom,
      eleveNom: eleve.nom,
      matricule: eleve.matricule,
      moyenneGenerale,
      mention: mentionFromMoyenne(moyenneGenerale, seuil, notationSur),
      notesDetaillees: details,
      hasNotes: classees.length > 0,
      nbMatieresNonClassees: details.length - classees.length,
    };
  });

  // 4. Rang général : seuls les élèves ayant des notes sont classés
  const classes = lignes.filter((l) => l.hasNotes);
  const rangs = rangsAvecExAequo(classes.map((l) => ({ id: l.eleveId, valeur: l.moyenneGenerale })));
  const moyennes = classes.map((l) => l.moyenneGenerale);
  const statsClasse = moyennes.length
    ? {
      moyenneClasse: r2(moyennes.reduce((a, b) => a + b, 0) / moyennes.length),
      moyenneForte: Math.max(...moyennes),
      moyenneFaible: Math.min(...moyennes),
      nbClasses: moyennes.length,
    }
    : { moyenneClasse: null, moyenneForte: null, moyenneFaible: null, nbClasses: 0 };

  return lignes.map((l) => ({
    ...l,
    rang: l.hasNotes ? rangs.get(l.eleveId) : null,
    effectifClasse: lignes.length,
    ...statsClasse,
  }));
}

export async function chargerConfigBulletin(tenantId) {
  const config = await prisma.tenantConfig.findUnique({ where: { tenantId } });
  return {
    notationSur: Number(config?.notationSur) || 20,
    seuilReussite: Number(config?.seuilReussite ?? 10),
    ponderation: config?.bulletinPonderation === 'devoirs_composition' ? 'devoirs_composition' : 'coefficients',
    poidsDevoirs: Number(config?.bulletinPoidsDevoirs ?? 50),
  };
}

/**
 * Résultats d'une classe pour une période (3 requêtes pour toute la classe).
 */
export async function calculerClasse(tenantId, { anneeScolaireId, classeId, periodeIndex }) {
  const config = await chargerConfigBulletin(tenantId);
  const periode = parseInt(periodeIndex, 10);

  const [inscriptions, notes, programme] = await Promise.all([
    prisma.inscription.findMany({
      where: { tenantId, classeId, anneeScolaireId, statut: 'validee' },
      include: { eleve: { select: { id: true, prenom: true, nom: true, matricule: true } } },
      orderBy: { eleve: { nom: 'asc' } },
    }),
    prisma.note.findMany({
      where: { tenantId, evaluation: { classeId, anneeScolaireId, periodeIndex: periode } },
      select: {
        eleveId: true,
        valeur: true,
        appreciation: true,
        updatedAt: true,
        evaluation: {
          select: {
            matiereId: true,
            nom: true,
            type: true,
            coefficient: true,
            noteMaximale: true,
            matiere: { select: { id: true, nom: true, code: true } },
          },
        },
      },
    }),
    getMatieresForClasse(tenantId, classeId),
  ]);

  // Matières : programme de la classe ayant au moins une évaluation sur la période, plus
  // toute matière évaluée hors programme (coefficient résolu une seule fois par matière)
  const evaluees = new Map();
  for (const n of notes) evaluees.set(n.evaluation.matiereId, n.evaluation.matiere);
  const evaluationsSansNote = await prisma.evaluation.findMany({
    where: { tenantId, classeId, anneeScolaireId, periodeIndex: periode },
    select: { matiereId: true, matiere: { select: { id: true, nom: true, code: true } } },
    distinct: ['matiereId'],
  });
  for (const e of evaluationsSansNote) evaluees.set(e.matiereId, e.matiere);

  const parProgramme = new Map(programme.map((p) => [p.matiereId, p]));
  const matieres = [];
  for (const [matiereId, matiere] of evaluees) {
    const prog = parProgramme.get(matiereId);
    const coefficient = prog
      ? Number(prog.coefficient)
      : await resolveCoefficient(tenantId, { classeId, matiereId, anneeScolaireId });
    matieres.push({ matiereId, nom: matiere.nom, code: matiere.code, coefficient });
  }
  matieres.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  return calculerResultatsClasse({
    eleves: inscriptions.map((i) => i.eleve),
    matieres,
    notes: notes.map((n) => ({
      eleveId: n.eleveId,
      matiereId: n.evaluation.matiereId,
      valeur: n.valeur,
      noteMaximale: n.evaluation.noteMaximale,
      coefficient: n.evaluation.coefficient,
      type: n.evaluation.type,
      evaluationNom: n.evaluation.nom,
      appreciation: n.appreciation,
      date: n.updatedAt,
    })),
    config,
  });
}

/**
 * Résultat d'un élève (rang et statistiques inclus, calculés sur la classe).
 */
export async function computeEleveBulletin(tenantId, { eleveId, classeId, anneeScolaireId, periodeIndex }) {
  const resultats = await calculerClasse(tenantId, { anneeScolaireId, classeId, periodeIndex });
  const ligne = resultats.find((r) => r.eleveId === eleveId);
  if (!ligne) {
    return { eleveId, moyenneGenerale: 0, mention: 'aucune', notesDetaillees: [], hasNotes: false };
  }
  return ligne;
}

/**
 * Moyenne annuelle d'une classe : moyenne des moyennes générales des périodes publiées
 * ou calculées (chaque période pèse autant), avec rang et proposition de décision.
 */
export function calculerMoyennesAnnuelles(bulletins = [], { seuilReussite = 10 } = {}) {
  const parEleve = new Map();
  for (const b of bulletins) {
    if (!parEleve.has(b.eleveId)) parEleve.set(b.eleveId, { eleve: b.eleve, periodes: {} });
    parEleve.get(b.eleveId).periodes[b.periodeIndex] = Number(b.moyenneGenerale);
  }
  const lignes = [...parEleve.entries()].map(([eleveId, { eleve, periodes }]) => {
    const valeurs = Object.values(periodes);
    const moyenneAnnuelle = valeurs.length ? r2(valeurs.reduce((a, b) => a + b, 0) / valeurs.length) : 0;
    return {
      eleveId,
      eleve,
      periodes,
      nbPeriodes: valeurs.length,
      moyenneAnnuelle,
      decisionProposee: moyenneAnnuelle >= seuilReussite ? 'admis' : 'non_admis',
    };
  });
  const rangs = rangsAvecExAequo(lignes.map((l) => ({ id: l.eleveId, valeur: l.moyenneAnnuelle })));
  return lignes
    .map((l) => ({ ...l, rang: rangs.get(l.eleveId), effectifClasse: lignes.length }))
    .sort((a, b) => a.rang - b.rang);
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
