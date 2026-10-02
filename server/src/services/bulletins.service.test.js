import { describe, it, expect } from 'vitest';
import {
  moyenneMatiere,
  rangsAvecExAequo,
  calculerResultatsClasse,
  calculerMoyennesAnnuelles,
  mentionFromMoyenne,
} from './bulletins.service.js';

const note = (valeur, over = {}) => ({ valeur, noteMaximale: 20, coefficient: 1, type: 'devoir', ...over });

describe('moyenneMatiere', () => {
  it('coefficients : moyenne pondérée par les évaluations', () => {
    // (10×1 + 16×2) / 3 = 14
    expect(moyenneMatiere([note(10), note(16, { coefficient: 2 })])).toBeCloseTo(14, 5);
  });

  it('ramène les notes à la notation de l\'école (sur 100)', () => {
    expect(moyenneMatiere([note(10, { noteMaximale: 20 })], { notationSur: 100 })).toBeCloseTo(50, 5);
    expect(moyenneMatiere([note(15, { noteMaximale: 10 })], { notationSur: 20 })).toBeCloseTo(30, 5);
  });

  it('devoirs + composition : 50 % / 50 %', () => {
    const notes = [note(10), note(12), note(16, { type: 'examen' })];
    // devoirs = 11, composition = 16 → 13,5
    expect(moyenneMatiere(notes, { ponderation: 'devoirs_composition', poidsDevoirs: 50 })).toBeCloseTo(13.5, 5);
    // 30 % devoirs → 11×0,3 + 16×0,7 = 14,5
    expect(moyenneMatiere(notes, { ponderation: 'devoirs_composition', poidsDevoirs: 30 })).toBeCloseTo(14.5, 5);
  });

  it('devoirs + composition : un seul type présent → ce type seul', () => {
    expect(moyenneMatiere([note(10), note(14)], { ponderation: 'devoirs_composition' })).toBeCloseTo(12, 5);
    expect(moyenneMatiere([note(8, { type: 'examen' })], { ponderation: 'devoirs_composition' })).toBeCloseTo(8, 5);
  });

  it('aucune note → null', () => {
    expect(moyenneMatiere([])).toBeNull();
  });
});

describe('rangs', () => {
  it('ex aequo : même rang, le suivant saute', () => {
    const r = rangsAvecExAequo([{ id: 'a', valeur: 15 }, { id: 'b', valeur: 15 }, { id: 'c', valeur: 12 }]);
    expect([r.get('a'), r.get('b'), r.get('c')]).toEqual([1, 1, 3]);
  });
});

describe('calculerResultatsClasse', () => {
  const eleves = [{ id: 'e1', nom: 'A' }, { id: 'e2', nom: 'B' }, { id: 'e3', nom: 'C' }];
  const matieres = [
    { matiereId: 'm1', nom: 'Maths', coefficient: 4 },
    { matiereId: 'm2', nom: 'Français', coefficient: 2 },
    { matiereId: 'm3', nom: 'EPS', coefficient: 1 },
  ];
  const n = (eleveId, matiereId, valeur, over = {}) => ({ eleveId, matiereId, valeur, noteMaximale: 20, coefficient: 1, type: 'devoir', ...over });
  const notes = [
    n('e1', 'm1', 16), n('e1', 'm2', 10), n('e1', 'm3', 18),
    n('e2', 'm1', 12), n('e2', 'm2', 14), // EPS sans note → non classé
    // e3 : aucune note
  ];
  const resultats = calculerResultatsClasse({ eleves, matieres, notes, config: { notationSur: 20, seuilReussite: 10 } });
  const parId = Object.fromEntries(resultats.map((r) => [r.eleveId, r]));

  it('moyenne générale pondérée par le coefficient de la matière', () => {
    // e1 : (16×4 + 10×2 + 18×1) / 7 = 14,57
    expect(parId.e1.moyenneGenerale).toBeCloseTo(14.57, 2);
  });

  it('matière sans note : non classée et exclue du calcul', () => {
    const eps = parId.e2.notesDetaillees.find((d) => d.matiereId === 'm3');
    expect(eps.nonClasse).toBe(true);
    // e2 : (12×4 + 14×2) / 6 = 12,67 — l'EPS (coef 1) n'entre pas dans la division
    expect(parId.e2.moyenneGenerale).toBeCloseTo(12.67, 2);
    expect(parId.e2.nbMatieresNonClassees).toBe(1);
  });

  it('élève sans aucune note : non classé, pas de rang', () => {
    expect(parId.e3).toMatchObject({ hasNotes: false, rang: null, moyenneGenerale: 0 });
  });

  it('rang général parmi les élèves ayant des notes, effectif = toute la classe', () => {
    expect(parId.e1.rang).toBe(1);
    expect(parId.e2.rang).toBe(2);
    expect(parId.e1.effectifClasse).toBe(3);
  });

  it('statistiques de classe (moyenne, plus forte, plus faible)', () => {
    expect(parId.e1.moyenneForte).toBeCloseTo(14.57, 2);
    expect(parId.e1.moyenneFaible).toBeCloseTo(12.67, 2);
    expect(parId.e1.moyenneClasse).toBeCloseTo(13.62, 1);
  });

  it('rang et statistiques par matière', () => {
    const maths = parId.e1.notesDetaillees.find((d) => d.matiereId === 'm1');
    expect(maths).toMatchObject({ rangMatiere: 1, moyenneClasse: 14, moyenneMin: 12, moyenneMax: 16 });
    expect(parId.e2.notesDetaillees.find((d) => d.matiereId === 'm1').rangMatiere).toBe(2);
    // Français : e1 = 10, e2 = 14 → e2 premier
    expect(parId.e2.notesDetaillees.find((d) => d.matiereId === 'm2').rangMatiere).toBe(1);
  });

  it('appréciation de l\'enseignant : dernière note commentée de la matière', () => {
    const r = calculerResultatsClasse({
      eleves: [{ id: 'e1' }],
      matieres: [{ matiereId: 'm1', nom: 'Maths', coefficient: 1 }],
      notes: [
        n('e1', 'm1', 12, { appreciation: 'Peut mieux faire', date: '2026-10-01' }),
        n('e1', 'm1', 15, { appreciation: 'Bon progrès', date: '2026-11-01' }),
        n('e1', 'm1', 14, { appreciation: '', date: '2026-12-01' }),
      ],
      config: {},
    });
    expect(r[0].notesDetaillees[0].appreciation).toBe('Bon progrès');
  });

  it('notation sur 100 : moyennes sur 100, seuil et mentions mis à l\'échelle', () => {
    const r = calculerResultatsClasse({
      eleves: [{ id: 'e1' }],
      matieres: [{ matiereId: 'm1', nom: 'Maths', coefficient: 1 }],
      notes: [{ eleveId: 'e1', matiereId: 'm1', valeur: 17, noteMaximale: 20, coefficient: 1, type: 'devoir' }],
      config: { notationSur: 100, seuilReussite: 50 },
    });
    expect(r[0].moyenneGenerale).toBe(85);
    expect(r[0].mention).toBe('felicitations'); // 85/100 = 17/20
  });
});

describe('mentions', () => {
  it('sur 20 et sur 100', () => {
    expect(mentionFromMoyenne(16.5, 10, 20)).toBe('felicitations');
    expect(mentionFromMoyenne(9, 10, 20)).toBe('avertissement_travail');
    expect(mentionFromMoyenne(72, 50, 100)).toBe('tableau_honneur'); // 14,4/20
    expect(mentionFromMoyenne(45, 50, 100)).toBe('avertissement_travail');
  });
});

describe('moyenne annuelle', () => {
  it('moyenne des périodes, rang, décision proposée', () => {
    const b = (eleveId, periodeIndex, moyenneGenerale) => ({ eleveId, periodeIndex, moyenneGenerale, eleve: { id: eleveId } });
    const r = calculerMoyennesAnnuelles(
      [b('e1', 1, 14), b('e1', 2, 12), b('e1', 3, 13), b('e2', 1, 9), b('e2', 2, 8), b('e2', 3, 10)],
      { seuilReussite: 10 }
    );
    expect(r[0]).toMatchObject({ eleveId: 'e1', moyenneAnnuelle: 13, rang: 1, decisionProposee: 'admis', nbPeriodes: 3 });
    expect(r[1]).toMatchObject({ eleveId: 'e2', moyenneAnnuelle: 9, rang: 2, decisionProposee: 'non_admis' });
  });
});
