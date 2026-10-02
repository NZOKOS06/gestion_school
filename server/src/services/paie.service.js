import { prisma } from '../utils/prisma.js';
import { startOfDayUTC, parseTimeOnDate, jsDateToJourSemaine } from '../utils/pointageHelpers.js';
import { toMinutes } from '../utils/horaires.js';

/**
 * Paie programmée et retenues de pointage.
 *
 * Calendrier : la paie d'un mois s'ouvre à partir du jour de paie (ex. le 10) du mois
 * suivant — la paie d'octobre s'ouvre le 10 novembre. Seul le mois écoulé peut être ouvert,
 * par le directeur ou le secrétaire ; un compte à rebours s'affiche N jours avant.
 *
 * Retenues (option école) sur les retards et absences pointés :
 * - proportionnel : salaire fixe / minutes de travail prévues du mois × minutes perdues ;
 * - forfaitaire : montant par retard + montant par absence.
 * Les absences justifiées ne sont retenues que si l'école l'a choisi.
 */

export const MOIS_LABELS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const JOURS_NOMS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOUR_MS = 24 * 60 * 60 * 1000;
const r2 = (n) => Math.round(n * 100) / 100;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Période de paie à ouvrir à une date donnée (le mois écoulé).
 * Retourne { mois, anneeCivile, libelle, dateOuverture, joursRestants, ouvrable, afficherRappel }.
 */
export function prochainePeriode({ paieJour = 10, paieRappelJours = 5 } = {}, maintenant = new Date()) {
  const jour = Math.min(28, Math.max(1, parseInt(paieJour, 10) || 10));
  const annee = maintenant.getFullYear();
  const moisCourant = maintenant.getMonth(); // 0-11
  const mois = moisCourant === 0 ? 12 : moisCourant; // mois écoulé (1-12)
  const anneeCivile = moisCourant === 0 ? annee - 1 : annee;

  const dateOuverture = new Date(annee, moisCourant, jour);
  const aujourdHui = new Date(annee, moisCourant, maintenant.getDate());
  const joursRestants = Math.max(0, Math.round((dateOuverture - aujourdHui) / JOUR_MS));
  const ouvrable = joursRestants === 0;

  return {
    mois,
    anneeCivile,
    libelle: `${MOIS_LABELS[mois]} ${anneeCivile}`,
    dateOuverture,
    joursRestants,
    ouvrable,
    afficherRappel: ouvrable || joursRestants <= Math.max(0, parseInt(paieRappelJours, 10) || 0),
  };
}

/** Bornes d'un mois civil (heure locale du serveur, comme le pointage). */
export function bornesMois(mois, anneeCivile) {
  return {
    debut: new Date(anneeCivile, mois - 1, 1),
    fin: new Date(anneeCivile, mois, 0, 23, 59, 59, 999),
  };
}

const minutesEntre = (a, b) => Math.round((b.getTime() - a.getTime()) / 60000);

/**
 * Récapitulatif d'un enseignant à partir des sessions de cours pointées (EDT).
 * sessions : [{ date, heurePrevueDebut, heurePrevueFin, heureArrivee, statut, justifiee }]
 */
export function recapSessionsEnseignant(sessions = [], { toleranceMinutes = 15 } = {}) {
  const recap = vide();
  for (const s of sessions) {
    if (s.statut === 'annulee') continue;
    const duree = Math.max(0, (toMinutes(s.heurePrevueFin) ?? 0) - (toMinutes(s.heurePrevueDebut) ?? 0));
    recap.minutesPrevues += duree;
    if (s.statut === 'absente') {
      ajouterAbsence(recap, duree, s.justifiee);
      continue;
    }
    if (!s.heureArrivee) {
      if (s.statut === 'prevue') recap.nonPointes += 1;
      continue;
    }
    const prevu = parseTimeOnDate(startOfDayUTC(s.date), s.heurePrevueDebut);
    const retard = minutesEntre(prevu, new Date(s.heureArrivee));
    if (retard > toleranceMinutes) ajouterRetard(recap, Math.min(retard, duree || retard), s.justifiee);
  }
  return recap;
}

/**
 * Récapitulatif du personnel hors enseignement (pointage journalier).
 * joursOuvres : dates (Date) des jours travaillés du mois.
 */
export function recapJournalier(pointages = [], joursOuvres = [], {
  heureArrivee = '08:00', heureDepart = '17:00', toleranceMinutes = 15,
} = {}) {
  const recap = vide();
  const dureeJour = Math.max(0, (toMinutes(heureDepart) ?? 0) - (toMinutes(heureArrivee) ?? 0));
  const parJour = new Map(pointages.map((p) => [startOfDayUTC(p.date).getTime(), p]));

  for (const jour of joursOuvres) {
    recap.minutesPrevues += dureeJour;
    const p = parJour.get(startOfDayUTC(jour).getTime());
    if (!p) {
      recap.nonPointes += 1;
      continue;
    }
    if (p.statut === 'conge') continue;
    if (p.statut === 'absent') {
      ajouterAbsence(recap, dureeJour, p.justifie);
      continue;
    }
    if (p.heureArrivee) {
      const prevu = parseTimeOnDate(startOfDayUTC(p.date), heureArrivee);
      const retard = minutesEntre(prevu, new Date(p.heureArrivee));
      if (retard > toleranceMinutes) ajouterRetard(recap, Math.min(retard, dureeJour || retard), p.justifie);
    }
  }
  return recap;
}

function vide() {
  return {
    minutesPrevues: 0,
    nbRetards: 0,
    minutesRetard: 0,
    nbRetardsJustifies: 0,
    minutesRetardJustifie: 0,
    nbAbsences: 0,
    minutesAbsence: 0,
    nbAbsencesJustifiees: 0,
    minutesAbsenceJustifiee: 0,
    nonPointes: 0,
  };
}

function ajouterAbsence(recap, minutes, justifiee) {
  if (justifiee) {
    recap.nbAbsencesJustifiees += 1;
    recap.minutesAbsenceJustifiee += minutes;
  } else {
    recap.nbAbsences += 1;
    recap.minutesAbsence += minutes;
  }
}

function ajouterRetard(recap, minutes, justifie) {
  if (justifie) {
    recap.nbRetardsJustifies += 1;
    recap.minutesRetardJustifie += minutes;
  } else {
    recap.nbRetards += 1;
    recap.minutesRetard += minutes;
  }
}

/**
 * Montant de la retenue (jamais supérieur au brut).
 * opts : { mode, montantFixe, brut, forfaitRetard, forfaitAbsence, absencesJustifieesRetenues }
 */
export function calculerRetenue(recap, {
  mode = 'proportionnel',
  montantFixe = 0,
  brut = 0,
  forfaitRetard = 0,
  forfaitAbsence = 0,
  absencesJustifieesRetenues = false,
} = {}) {
  const nbAbsences = recap.nbAbsences + (absencesJustifieesRetenues ? recap.nbAbsencesJustifiees : 0);
  const minutesAbsence = recap.minutesAbsence + (absencesJustifieesRetenues ? recap.minutesAbsenceJustifiee : 0);

  let montantRetards = 0;
  let montantAbsences = 0;
  let valeurMinute = null;

  if (mode === 'forfaitaire') {
    montantRetards = recap.nbRetards * num(forfaitRetard);
    montantAbsences = nbAbsences * num(forfaitAbsence);
  } else if (num(montantFixe) > 0 && recap.minutesPrevues > 0) {
    // Proportionnel : seule la part fixe est concernée (les heures non faites ne sont déjà pas payées)
    valeurMinute = num(montantFixe) / recap.minutesPrevues;
    montantRetards = recap.minutesRetard * valeurMinute;
    montantAbsences = minutesAbsence * valeurMinute;
  }

  const total = Math.min(num(brut), r2(montantRetards + montantAbsences));
  return {
    mode,
    valeurMinute: valeurMinute === null ? null : r2(valeurMinute),
    montantRetards: r2(montantRetards),
    montantAbsences: r2(montantAbsences),
    nbAbsencesRetenues: nbAbsences,
    minutesAbsenceRetenues: minutesAbsence,
    total: r2(Math.max(0, total)),
    plafonne: r2(montantRetards + montantAbsences) > num(brut),
  };
}

/** Jours travaillés du mois selon les jours d'école (lundi → vendredi par défaut). */
export function joursOuvresDuMois(mois, anneeCivile, joursEcole = []) {
  const actifs = new Set((joursEcole.length ? joursEcole : ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'])
    .map((j) => String(j).toLowerCase()));
  const { debut, fin } = bornesMois(mois, anneeCivile);
  const jours = [];
  for (let d = new Date(debut); d <= fin; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (actifs.has(JOURS_NOMS[jsDateToJourSemaine(d)])) jours.push(new Date(d));
  }
  return jours;
}

/** Récapitulatif pointage d'un agent pour un mois (lecture base). */
export async function recapPointageStaff(tenantId, staff, { mois, anneeCivile, config, joursEcole }) {
  const { debut, fin } = bornesMois(mois, anneeCivile);
  const toleranceMinutes = config?.pointageToleranceMinutes ?? 15;

  if (staff.role === 'enseignant') {
    const sessions = await prisma.pointageSession.findMany({
      where: { tenantId, enseignantId: staff.id, date: { gte: startOfDayUTC(debut), lte: fin } },
      select: { date: true, heurePrevueDebut: true, heurePrevueFin: true, heureArrivee: true, statut: true, justifiee: true },
    });
    return { source: 'emploi_du_temps', ...recapSessionsEnseignant(sessions, { toleranceMinutes }) };
  }

  const pointages = await prisma.pointageJournalier.findMany({
    where: { tenantId, staffId: staff.id, date: { gte: startOfDayUTC(debut), lte: fin } },
  });
  return {
    source: 'journalier',
    ...recapJournalier(pointages, joursOuvresDuMois(mois, anneeCivile, joursEcole), {
      heureArrivee: staff.heureArriveePrevue || config?.heureDebut || '08:00',
      heureDepart: staff.heureDepartPrevue || config?.heureFin || '17:00',
      toleranceMinutes,
    }),
  };
}
