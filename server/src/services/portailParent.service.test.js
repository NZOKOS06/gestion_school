import { describe, it, expect } from 'vitest';
import { impayeMoisEcoule, situationNotes, genererMotDePasseProvisoire } from './portailParent.service.js';

const d = (y, m, j = 5) => new Date(Date.UTC(y, m, j, 12));
const novembre = new Date(Date.UTC(2026, 10, 15));

describe('impayé du mois écoulé (blocage des notes)', () => {
  it('ne compte que la scolarité échue avant le mois en cours', () => {
    const echeances = [
      { libelle: "Frais d'inscription", categorie: 'inscription', montantAttendu: 20000, montantPaye: 20000, dateEcheance: d(2026, 8, 15) },
      { libelle: 'Octobre 2026', categorie: 'scolarite', montantAttendu: 30000, montantPaye: 10000, dateEcheance: d(2026, 9) },
      { libelle: 'Novembre 2026', categorie: 'scolarite', montantAttendu: 30000, montantPaye: 0, dateEcheance: d(2026, 10) },
    ];
    expect(impayeMoisEcoule(echeances, novembre)).toBe(20000);
  });

  it('les services optionnels (cantine, TD…) ne bloquent pas les notes', () => {
    const echeances = [
      { libelle: 'Octobre 2026', categorie: 'scolarite', montantAttendu: 30000, montantPaye: 30000, dateEcheance: d(2026, 9) },
      { libelle: 'Cantine — Octobre 2026', categorie: 'service', souscriptionServiceId: 's1', montantAttendu: 10000, montantPaye: 0, dateEcheance: d(2026, 9) },
    ];
    expect(impayeMoisEcoule(echeances, novembre)).toBe(0);
  });

  it('le mois en cours non payé ne bloque pas encore', () => {
    const echeances = [
      { libelle: 'Novembre 2026', categorie: 'scolarite', montantAttendu: 30000, montantPaye: 0, dateEcheance: d(2026, 10) },
    ];
    expect(impayeMoisEcoule(echeances, novembre)).toBe(0);
  });
});

describe('situationNotes', () => {
  const impaye = {
    derogationNotes: false,
    echeances: [{ libelle: 'Octobre 2026', categorie: 'scolarite', montantAttendu: 30000, montantPaye: 0, dateEcheance: d(2026, 9) }],
  };

  it('bloque avec le montant dû et un message', async () => {
    const s = await situationNotes('t1', 'e1', { inscription: impaye, maintenant: novembre });
    expect(s).toMatchObject({ accessible: false, montantDu: 30000 });
    expect(s.message).toMatch(/régularisation/);
  });

  it('dérogation du directeur : accès malgré l\'impayé', async () => {
    const s = await situationNotes('t1', 'e1', { inscription: { ...impaye, derogationNotes: true }, maintenant: novembre });
    expect(s).toMatchObject({ accessible: true, derogation: true });
  });

  it('à jour : accès', async () => {
    const aJour = { ...impaye, echeances: [{ ...impaye.echeances[0], montantPaye: 30000 }] };
    expect((await situationNotes('t1', 'e1', { inscription: aJour, maintenant: novembre })).accessible).toBe(true);
  });
});

describe('mot de passe provisoire', () => {
  it('lisible et différent à chaque génération', () => {
    const a = genererMotDePasseProvisoire();
    expect(a).toMatch(/^[A-HJKMNP-Z]{4}-[2-9]{4}$/);
    expect(genererMotDePasseProvisoire()).not.toBe(a);
  });
});
