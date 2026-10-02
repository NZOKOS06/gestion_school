import { describe, it, expect } from 'vitest';
import {
  resolveFees,
  appliquerTarifSpecial,
  modifierTarifInscription,
  FraisError,
} from './fraisInscription.service.js';

function fakeDb({ classe = {}, config = {}, inscriptionsPrecedentes = [], echeances = [] } = {}) {
  const state = { echeances: echeances.map((e, i) => ({ id: `e${i}`, ...e })), inscription: {} };
  return {
    state,
    classe: { findFirst: async () => ({ anneeScolaireId: 'a2', ...classe }) },
    tenantConfig: { findUnique: async () => config },
    inscription: {
      findFirst: async () => inscriptionsPrecedentes[0] || null,
      update: async ({ data }) => Object.assign(state.inscription, data),
    },
    anneeScolaire: { findUnique: async () => null },
    echeance: {
      findMany: async () => state.echeances,
      update: async ({ where, data }) => Object.assign(state.echeances.find((e) => e.id === where.id), data),
      create: async ({ data }) => state.echeances.push({ id: `n${state.echeances.length}`, ...data }),
      createMany: async ({ data }) => data.forEach((d) => state.echeances.push({ id: `m${state.echeances.length}`, ...d })),
    },
  };
}

describe('resolveFees', () => {
  it('nouvel élève : frais d\'inscription de la classe', async () => {
    const db = fakeDb({ classe: { fraisInscription: 20000, fraisReinscription: 10000, fraisScolarite: 270000 } });
    const fees = await resolveFees('t1', 'c1', { eleveId: 'el1', db });
    expect(fees).toMatchObject({ typeFrais: 'inscription', fraisInscription: 20000, fraisScolarite: 270000 });
  });

  it('ancien élève : frais de réinscription de la classe', async () => {
    const db = fakeDb({
      classe: { fraisInscription: 20000, fraisReinscription: 10000, fraisScolarite: 270000 },
      inscriptionsPrecedentes: [{ id: 'old' }],
    });
    const fees = await resolveFees('t1', 'c1', { eleveId: 'el1', db });
    expect(fees).toMatchObject({ typeFrais: 'reinscription', fraisInscription: 10000, sourceFraisInscription: 'classe_reinscription' });
  });

  it('réinscription sans tarif classe → défaut école réinscription, puis inscription', async () => {
    const db1 = fakeDb({
      classe: { fraisInscription: 20000, fraisReinscription: 0 },
      config: { fraisReinscriptionDefault: 7500 },
    });
    expect((await resolveFees('t1', 'c1', { typeFrais: 'reinscription', db: db1 })).fraisInscription).toBe(7500);

    const db2 = fakeDb({ classe: { fraisInscription: 20000 }, config: {} });
    expect((await resolveFees('t1', 'c1', { typeFrais: 'reinscription', db: db2 })).fraisInscription).toBe(20000);
  });

  it('classe sans frais d\'inscription → défaut école', async () => {
    const db = fakeDb({ classe: { fraisInscription: 0 }, config: { fraisInscriptionDefault: 15000 } });
    const fees = await resolveFees('t1', 'c1', { db });
    expect(fees).toMatchObject({ fraisInscription: 15000, sourceFraisInscription: 'ecole_inscription' });
  });
});

describe('appliquerTarifSpecial', () => {
  const base = { typeFrais: 'inscription', fraisInscription: 20000, fraisScolarite: 270000 };

  it('sans modification : pas de tarif spécial', () => {
    expect(appliquerTarifSpecial(base, {})).toMatchObject({ tarifSpecial: false, fraisInscription: 20000 });
  });

  it('montant modifié sans motif → refus', () => {
    expect(() => appliquerTarifSpecial(base, { fraisInscription: 0 })).toThrow(FraisError);
  });

  it('montant modifié avec motif → tarif spécial', () => {
    const out = appliquerTarifSpecial(base, { fraisInscription: 0, fraisScolarite: 135000, motifTarifSpecial: 'Famille en difficulté' });
    expect(out).toMatchObject({ tarifSpecial: true, fraisInscription: 0, fraisScolarite: 135000, motifTarifSpecial: 'Famille en difficulté' });
  });

  it('montant négatif → refus', () => {
    expect(() => appliquerTarifSpecial(base, { fraisScolarite: -1, motifTarifSpecial: 'x' })).toThrow(FraisError);
  });
});

describe('modifierTarifInscription', () => {
  const futur = new Date(Date.now() + 30 * 86400000);
  const echeances = () => [
    { libelle: "Frais d'inscription", montantAttendu: 20000, montantPaye: 20000, dateEcheance: futur },
    { libelle: 'Octobre 2026', montantAttendu: 30000, montantPaye: 30000, dateEcheance: futur },
    { libelle: 'Novembre 2026', montantAttendu: 30000, montantPaye: 10000, dateEcheance: futur },
    { libelle: 'Décembre 2026', montantAttendu: 30000, montantPaye: 0, dateEcheance: futur },
  ];

  it('répartit le reste dû sur les échéances non soldées sans toucher aux paiements', async () => {
    const db = fakeDb({ echeances: echeances() });
    const solde = await modifierTarifInscription(db, 't1', { id: 'i1' }, {
      fraisInscription: 20000, fraisScolarite: 60000, tarifSpecial: true, motifTarifSpecial: 'Remise',
    });
    const [, oct, nov, dec] = db.state.echeances;
    expect(Number(oct.montantAttendu)).toBe(30000); // soldée : inchangée
    // déjà payé 40 000 → reste 20 000 réparti sur novembre et décembre
    expect(Number(nov.montantAttendu)).toBe(20000);
    expect(Number(dec.montantAttendu)).toBe(10000);
    expect(solde).toBe(20000);
    expect(db.state.inscription).toMatchObject({ tarifSpecial: true, fraisScolariteApplique: 60000 });
  });

  it('refuse une scolarité inférieure au déjà payé', async () => {
    const db = fakeDb({ echeances: echeances() });
    await expect(modifierTarifInscription(db, 't1', { id: 'i1' }, {
      fraisInscription: 20000, fraisScolarite: 30000, tarifSpecial: true, motifTarifSpecial: 'x',
    })).rejects.toThrow(FraisError);
  });

  it('frais d\'inscription ramenés à 0 avant tout paiement', async () => {
    const db = fakeDb({ echeances: [{ libelle: "Frais d'inscription", montantAttendu: 20000, montantPaye: 0, dateEcheance: futur }] });
    const solde = await modifierTarifInscription(db, 't1', { id: 'i1' }, {
      fraisInscription: 0, fraisScolarite: 0, tarifSpecial: true, motifTarifSpecial: 'Exonération',
    });
    expect(db.state.echeances[0]).toMatchObject({ montantAttendu: 0, statut: 'payee' });
    expect(solde).toBe(0);
  });
});

describe('régimes et cantine', () => {
  it('mi-temps : scolarité mi-temps de la classe si les régimes sont activés', async () => {
    const db = fakeDb({
      classe: { fraisInscription: 20000, fraisScolarite: 270000, fraisScolariteMiTemps: 135000 },
      config: { regimesActifs: true },
    });
    const fees = await resolveFees('t1', 'c1', { regime: 'mi_temps', db });
    expect(fees).toMatchObject({ regime: 'mi_temps', fraisScolarite: 135000, fraisInscription: 20000 });
  });

  it('mi-temps ignoré si l\'option est désactivée', async () => {
    const db = fakeDb({ classe: { fraisScolarite: 270000, fraisScolariteMiTemps: 135000 }, config: {} });
    const fees = await resolveFees('t1', 'c1', { regime: 'mi_temps', db });
    expect(fees).toMatchObject({ regime: 'plein_temps', fraisScolarite: 270000 });
  });

  it('mi-temps sans tarif renseigné → refus', async () => {
    const db = fakeDb({ classe: { fraisScolarite: 270000 }, config: { regimesActifs: true } });
    await expect(resolveFees('t1', 'c1', { regime: 'mi_temps', db })).rejects.toThrow(FraisError);
  });

  it('modifier le tarif ne touche pas aux échéances des services optionnels', async () => {
    const futur = new Date(Date.now() + 30 * 86400000);
    const db = fakeDb({
      echeances: [
        { libelle: 'Octobre 2026', categorie: 'scolarite', montantAttendu: 30000, montantPaye: 0, dateEcheance: futur },
        { libelle: 'Cantine — Octobre 2026', categorie: 'service', souscriptionServiceId: 's1', montantAttendu: 10000, montantPaye: 0, dateEcheance: futur },
      ],
    });
    await modifierTarifInscription(db, 't1', { id: 'i1' }, { fraisInscription: 0, fraisScolarite: 15000, tarifSpecial: true, motifTarifSpecial: 'x' });
    expect(Number(db.state.echeances[0].montantAttendu)).toBe(15000);
    expect(Number(db.state.echeances[1].montantAttendu)).toBe(10000);
  });
});

