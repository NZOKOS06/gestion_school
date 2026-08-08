/** Référentiel scolaire République du Congo (Congo-Brazzaville) — version actuelle */

export const NIVEAUX_CG_ACTUEL = [
  { code: 'PS', libelle: 'Petite Section', cycle: 'prescolaire', ordre: 1, ageIndicatif: 3 },
  { code: 'MS', libelle: 'Moyenne Section', cycle: 'prescolaire', ordre: 2, ageIndicatif: 4 },
  { code: 'GS', libelle: 'Grande Section', cycle: 'prescolaire', ordre: 3, ageIndicatif: 5 },
  { code: 'CP1', libelle: 'Cours Préparatoire 1', cycle: 'primaire', ordre: 4, ageIndicatif: 6 },
  { code: 'CP2', libelle: 'Cours Préparatoire 2', cycle: 'primaire', ordre: 5, ageIndicatif: 7 },
  { code: 'CE1', libelle: 'Cours Élémentaire 1', cycle: 'primaire', ordre: 6, ageIndicatif: 8 },
  { code: 'CE2', libelle: 'Cours Élémentaire 2', cycle: 'primaire', ordre: 7, ageIndicatif: 9 },
  { code: 'CM1', libelle: 'Cours Moyen 1', cycle: 'primaire', ordre: 8, ageIndicatif: 10 },
  { code: 'CM2', libelle: 'Cours Moyen 2', cycle: 'primaire', ordre: 9, ageIndicatif: 11, typeExamenSortie: 'CEPE' },
  { code: '6e', libelle: 'Sixième', cycle: 'college', ordre: 10, ageIndicatif: 12 },
  { code: '5e', libelle: 'Cinquième', cycle: 'college', ordre: 11, ageIndicatif: 13 },
  { code: '4e', libelle: 'Quatrième', cycle: 'college', ordre: 12, ageIndicatif: 14 },
  { code: '3e', libelle: 'Troisième', cycle: 'college', ordre: 13, ageIndicatif: 15, typeExamenSortie: 'BEPC' },
  { code: '2nde', libelle: 'Seconde', cycle: 'lycee', ordre: 14, ageIndicatif: 16 },
  { code: '1ere', libelle: 'Première', cycle: 'lycee', ordre: 15, ageIndicatif: 17 },
  { code: 'Tle', libelle: 'Terminale', cycle: 'lycee', ordre: 16, ageIndicatif: 18, typeExamenSortie: 'BAC_GENERAL' },
];

export const FILIERES_CG_ACTUEL = [
  { code: 'generale', libelle: 'Générale', cycle: 'lycee' },
  { code: 'scientifique', libelle: 'Scientifique', cycle: 'lycee' },
  { code: 'litteraire', libelle: 'Littéraire', cycle: 'lycee' },
];

/** Périodes indicatives année 2025-2026 */
export const PERIODES_2025_2026 = [
  {
    index: 1,
    libelle: '1er trimestre',
    dateDebut: '2025-10-01',
    dateFin: '2025-12-20',
    dateEvaluationDebut: '2025-12-08',
    dateEvaluationFin: '2025-12-19',
    poids: 1,
    concerneCycles: ['college', 'lycee'],
  },
  {
    index: 2,
    libelle: '2e trimestre',
    dateDebut: '2026-01-05',
    dateFin: '2026-03-28',
    dateEvaluationDebut: '2026-03-16',
    dateEvaluationFin: '2026-03-27',
    poids: 1,
    concerneCycles: ['college', 'lycee'],
  },
  {
    index: 3,
    libelle: '3e trimestre',
    dateDebut: '2026-04-13',
    dateFin: '2026-07-15',
    dateEvaluationDebut: '2026-06-22',
    dateEvaluationFin: '2026-07-03',
    poids: 1,
    concerneCycles: ['college', 'lycee'],
  },
  // Compositions mensuelles préscolaire / primaire
  { index: 10, libelle: 'Composition Octobre', dateDebut: '2025-10-01', dateFin: '2025-10-31', poids: 1, concerneCycles: ['prescolaire', 'primaire'] },
  { index: 11, libelle: 'Composition Novembre', dateDebut: '2025-11-01', dateFin: '2025-11-30', poids: 1, concerneCycles: ['prescolaire', 'primaire'] },
  { index: 12, libelle: 'Composition Décembre', dateDebut: '2025-12-01', dateFin: '2025-12-20', poids: 1, concerneCycles: ['prescolaire', 'primaire'] },
  { index: 13, libelle: 'Composition Janvier', dateDebut: '2026-01-05', dateFin: '2026-01-31', poids: 1, concerneCycles: ['prescolaire', 'primaire'] },
  { index: 14, libelle: 'Composition Février', dateDebut: '2026-02-01', dateFin: '2026-02-28', poids: 1, concerneCycles: ['prescolaire', 'primaire'] },
  { index: 15, libelle: 'Composition Mars', dateDebut: '2026-03-01', dateFin: '2026-03-28', poids: 1, concerneCycles: ['prescolaire', 'primaire'] },
  { index: 16, libelle: 'Composition Avril', dateDebut: '2026-04-13', dateFin: '2026-04-30', poids: 1, concerneCycles: ['prescolaire', 'primaire'] },
  { index: 17, libelle: 'Composition Mai', dateDebut: '2026-05-01', dateFin: '2026-05-31', poids: 1, concerneCycles: ['prescolaire', 'primaire'] },
];

/** Map niveau code → next level code for passage */
export const PASSAGE_NIVEAU = {
  PS: 'MS',
  MS: 'GS',
  GS: 'CP1',
  CP1: 'CP2',
  CP2: 'CE1',
  CE1: 'CE2',
  CE2: 'CM1',
  CM1: 'CM2',
  CM2: '6e',
  '6e': '5e',
  '5e': '4e',
  '4e': '3e',
  '3e': '2nde',
  '2nde': '1ere',
  '1ere': 'Tle',
  Tle: null,
};

export function buildCalendrierTemplatesFromPeriodes(periodes, anneeLibelle = '2025-2026') {
  const events = [];
  if (!periodes?.length) return events;

  const p1 = periodes.find((p) => p.index === 1);
  if (p1) {
    events.push({
      titre: `Rentrée scolaire ${anneeLibelle}`,
      type: 'rentree',
      dateDebut: p1.dateDebut,
      dateFin: p1.dateDebut,
      description: 'Premier jour de classe',
    });
  }

  // Vacances Noël entre T1 et T2
  if (p1 && periodes.find((p) => p.index === 2)) {
    const t2 = periodes.find((p) => p.index === 2);
    const vacDebut = new Date(p1.dateFin);
    vacDebut.setDate(vacDebut.getDate() + 1);
    const vacFin = new Date(t2.dateDebut);
    vacFin.setDate(vacFin.getDate() - 1);
    events.push({
      titre: 'Vacances de Noël',
      type: 'vacances',
      dateDebut: vacDebut.toISOString().slice(0, 10),
      dateFin: vacFin.toISOString().slice(0, 10),
      description: 'Vacances de fin d’année',
    });
  }

  for (const p of periodes) {
    if (p.dateEvaluationDebut) {
      events.push({
        titre: `Compositions ${p.libelle}`,
        type: 'composition',
        dateDebut: p.dateEvaluationDebut,
        dateFin: p.dateEvaluationFin || p.dateEvaluationDebut,
        description: `Évaluations de fin de ${p.libelle}`,
      });
    }
  }

  return events;
}
