import { describe, it, expect } from 'vitest';
import {
  prochainePeriode,
  recapSessionsEnseignant,
  recapJournalier,
  calculerRetenue,
  joursOuvresDuMois,
} from './paie.service.js';

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const jourUTC = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

describe('paie programmée', () => {
  it('le 10 novembre, la paie d\'octobre est ouvrable', () => {
    const p = prochainePeriode({ paieJour: 10 }, at(2026, 11, 10, 9));
    expect(p).toMatchObject({ mois: 10, anneeCivile: 2026, ouvrable: true, joursRestants: 0, libelle: 'Octobre 2026' });
  });

  it('le 7 novembre : compte à rebours de 3 jours, rappel affiché (5 jours avant)', () => {
    const p = prochainePeriode({ paieJour: 10, paieRappelJours: 5 }, at(2026, 11, 7, 18));
    expect(p).toMatchObject({ mois: 10, ouvrable: false, joursRestants: 3, afficherRappel: true });
  });

  it('le 1er novembre : trop tôt pour le rappel', () => {
    expect(prochainePeriode({ paieJour: 10, paieRappelJours: 5 }, at(2026, 11, 1)).afficherRappel).toBe(false);
  });

  it('en janvier, c\'est la paie de décembre de l\'année précédente', () => {
    expect(prochainePeriode({ paieJour: 10 }, at(2027, 1, 15))).toMatchObject({ mois: 12, anneeCivile: 2026, ouvrable: true });
  });
});

describe('récapitulatif de pointage', () => {
  it('enseignant : retards au-delà de la tolérance, absences, non pointés', () => {
    const recap = recapSessionsEnseignant([
      // 07:10-07:45 arrivé à 07:30 → 20 min de retard
      { date: jourUTC(2026, 10, 5), heurePrevueDebut: '07:10', heurePrevueFin: '07:45', heureArrivee: at(2026, 10, 5, 7, 30), statut: 'terminee' },
      // arrivé 07:50 pour 07:45 → 5 min, dans la tolérance
      { date: jourUTC(2026, 10, 5), heurePrevueDebut: '07:45', heurePrevueFin: '08:30', heureArrivee: at(2026, 10, 5, 7, 50), statut: 'terminee' },
      { date: jourUTC(2026, 10, 6), heurePrevueDebut: '08:00', heurePrevueFin: '09:00', statut: 'absente' },
      { date: jourUTC(2026, 10, 7), heurePrevueDebut: '08:00', heurePrevueFin: '09:00', statut: 'absente', justifiee: true },
      { date: jourUTC(2026, 10, 8), heurePrevueDebut: '08:00', heurePrevueFin: '09:00', statut: 'prevue' },
    ], { toleranceMinutes: 10 });
    expect(recap).toMatchObject({
      minutesPrevues: 35 + 45 + 60 + 60 + 60,
      nbRetards: 1, minutesRetard: 20,
      nbAbsences: 1, minutesAbsence: 60,
      nbAbsencesJustifiees: 1, minutesAbsenceJustifiee: 60,
      nonPointes: 1,
    });
  });

  it('personnel administratif : jours ouvrés, retard, absence, congé', () => {
    const jours = [jourUTC(2026, 10, 5), jourUTC(2026, 10, 6), jourUTC(2026, 10, 7), jourUTC(2026, 10, 8)];
    const recap = recapJournalier([
      { date: jourUTC(2026, 10, 5), statut: 'present', heureArrivee: at(2026, 10, 5, 8, 40) },
      { date: jourUTC(2026, 10, 6), statut: 'absent' },
      { date: jourUTC(2026, 10, 7), statut: 'conge' },
    ], jours, { heureArrivee: '08:00', heureDepart: '16:00', toleranceMinutes: 15 });
    expect(recap).toMatchObject({ minutesPrevues: 4 * 480, nbRetards: 1, minutesRetard: 40, nbAbsences: 1, minutesAbsence: 480, nonPointes: 1 });
  });

  it('jours ouvrés selon les jours d\'école', () => {
    expect(joursOuvresDuMois(10, 2026)).toHaveLength(22); // octobre 2026, lundi → vendredi
    expect(joursOuvresDuMois(10, 2026, ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'])).toHaveLength(27);
  });
});

describe('retenues', () => {
  const recap = {
    minutesPrevues: 9600, nbRetards: 2, minutesRetard: 60, nbAbsences: 1, minutesAbsence: 480,
    nbAbsencesJustifiees: 1, minutesAbsenceJustifiee: 480, nbRetardsJustifies: 0, minutesRetardJustifie: 0, nonPointes: 0,
  };

  it('proportionnel : salaire fixe / minutes prévues × minutes perdues', () => {
    const r = calculerRetenue(recap, { mode: 'proportionnel', montantFixe: 192000, brut: 192000 });
    // 192 000 / 9 600 = 20 / minute → (60 + 480) × 20
    expect(r).toMatchObject({ valeurMinute: 20, montantRetards: 1200, montantAbsences: 9600, total: 10800 });
  });

  it('absences justifiées retenues seulement si l\'école l\'a choisi', () => {
    const r = calculerRetenue(recap, { mode: 'proportionnel', montantFixe: 192000, brut: 192000, absencesJustifieesRetenues: true });
    expect(r.total).toBe(1200 + 960 * 20);
  });

  it('forfaitaire : montant par retard et par absence', () => {
    const r = calculerRetenue(recap, { mode: 'forfaitaire', brut: 100000, forfaitRetard: 1000, forfaitAbsence: 5000 });
    expect(r).toMatchObject({ montantRetards: 2000, montantAbsences: 5000, total: 7000 });
  });

  it('jamais plus que le brut', () => {
    const r = calculerRetenue(recap, { mode: 'forfaitaire', brut: 3000, forfaitRetard: 1000, forfaitAbsence: 5000 });
    expect(r).toMatchObject({ total: 3000, plafonne: true });
  });

  it('vacataire payé à l\'heure : pas de retenue proportionnelle (heures non faites déjà non payées)', () => {
    expect(calculerRetenue(recap, { mode: 'proportionnel', montantFixe: 0, brut: 50000 }).total).toBe(0);
  });
});
