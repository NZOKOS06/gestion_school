import { describe, it, expect } from 'vitest';
import {
  serviceApplicable,
  souscrireService,
  arreterService,
  modifierTarifService,
  normaliserService,
} from './servicesOptionnels.service.js';
import { periodesService } from './echeances.service.js';
import { FraisError } from './fraisInscription.service.js';

const annee = { dateDebut: new Date(Date.UTC(2026, 8, 1)), dateFin: new Date(Date.UTC(2027, 5, 30)) };

function fakeTx({ echeances = [], souscription = null } = {}) {
  const state = { echeances: echeances.map((e, i) => ({ id: `e${i}`, ...e })), souscription };
  return {
    state,
    anneeScolaire: { findUnique: async () => annee },
    souscriptionService: {
      findFirst: async () => state.souscription,
      create: async ({ data }) => { state.souscription = { id: 's1', ...data }; return state.souscription; },
      update: async ({ data }) => Object.assign(state.souscription, data),
    },
    echeance: {
      findMany: async ({ where }) => state.echeances.filter((e) => (!where.souscriptionServiceId || e.souscriptionServiceId === where.souscriptionServiceId)
        && e.statut !== 'annulee'),
      createMany: async ({ data }) => data.forEach((d) => state.echeances.push({ id: `n${state.echeances.length}`, ...d })),
      update: async ({ where, data }) => Object.assign(state.echeances.find((e) => e.id === where.id), data),
    },
  };
}

const cantine = { id: 'svc-cantine', nom: 'Cantine', tarif: 10000, periodicite: 'mensuelle', actif: true };
const inscription = { id: 'i1', anneeScolaireId: 'a1' };

describe('catalogue de services', () => {
  it('service ciblé sur des cycles / classes', () => {
    const td = { actif: true, cycles: ['college'], classeIds: null };
    expect(serviceApplicable(td, { id: 'c1', cycle: 'college' })).toBe(true);
    expect(serviceApplicable(td, { id: 'c2', cycle: 'primaire' })).toBe(false);
    expect(serviceApplicable({ ...td, classeIds: ['c9'] }, { id: 'c1', cycle: 'college' })).toBe(false);
    expect(serviceApplicable({ ...td, actif: false }, { id: 'c1', cycle: 'college' })).toBe(false);
  });

  it('périodicités : mensuelle, trimestrielle, annuelle, unique', () => {
    const { dateDebut: d, dateFin: f } = annee;
    expect(periodesService(d, f, 'mensuelle', 'Garderie')).toHaveLength(10);
    expect(periodesService(d, f, 'trimestrielle', 'Transport').map((p) => p.libelle)).toEqual([
      'Transport — Trimestre 1', 'Transport — Trimestre 2', 'Transport — Trimestre 3', 'Transport — Trimestre 4',
    ]);
    expect(periodesService(d, f, 'annuelle', 'Crèche')).toEqual([expect.objectContaining({ libelle: 'Crèche — Année scolaire' })]);
    expect(periodesService(d, f, 'unique', 'Cours de vacances')[0].libelle).toBe('Cours de vacances');
  });

  it('nom obligatoire, tarif positif', () => {
    expect(() => normaliserService({ nom: '', tarif: 1 })).toThrow(FraisError);
    expect(() => normaliserService({ nom: 'TD', tarif: -5 })).toThrow(FraisError);
    expect(normaliserService({ nom: ' TD Maths ', tarif: '5000', periodicite: 'bizarre' }))
      .toMatchObject({ nom: 'TD Maths', tarif: 5000, periodicite: 'mensuelle' });
  });
});

describe('souscription à un service', () => {
  it('en cours d\'année : échéances à partir du mois courant, rattachées au service', async () => {
    const tx = fakeTx();
    await souscrireService(tx, 't1', inscription, cantine, { maintenant: new Date(Date.UTC(2026, 10, 20)) });
    expect(tx.state.echeances[0]).toMatchObject({
      libelle: 'Cantine — Novembre 2026', categorie: 'service', souscriptionServiceId: 's1', montantAttendu: 10000,
    });
    expect(tx.state.echeances).toHaveLength(8);
  });

  it('tarif spécial à la souscription : motif obligatoire', async () => {
    await expect(souscrireService(fakeTx(), 't1', inscription, cantine, { tarif: 5000 })).rejects.toThrow(FraisError);
    const tx = fakeTx();
    await souscrireService(tx, 't1', inscription, cantine, {
      tarif: 5000, motifTarifSpecial: 'Cas social', maintenant: new Date(Date.UTC(2026, 8, 2)),
    });
    expect(tx.state.souscription).toMatchObject({ tarifApplique: 5000, tarifSpecial: true });
    expect(tx.state.echeances.every((e) => e.montantAttendu === 5000)).toBe(true);
  });

  it('refuse une double souscription', async () => {
    const tx = fakeTx({ souscription: { id: 's1', actif: true } });
    await expect(souscrireService(tx, 't1', inscription, cantine)).rejects.toThrow(FraisError);
  });

  it('réabonnement après arrêt : pas de période facturée deux fois', async () => {
    const tx = fakeTx({
      souscription: { id: 's1', actif: false },
      echeances: [{ souscriptionServiceId: 's1', libelle: 'Cantine — Novembre 2026', montantAttendu: 10000, montantPaye: 10000, statut: 'payee' }],
    });
    await souscrireService(tx, 't1', inscription, cantine, { maintenant: new Date(Date.UTC(2026, 10, 25)) });
    expect(tx.state.echeances.filter((e) => e.libelle === 'Cantine — Novembre 2026')).toHaveLength(1);
    expect(tx.state.souscription.actif).toBe(true);
  });

  it('arrêt : périodes futures arrêtées, passé et mois en cours dus', async () => {
    const d = (y, m) => new Date(Date.UTC(y, m, 5, 12));
    const tx = fakeTx({
      souscription: { id: 's1', actif: true },
      echeances: [
        { souscriptionServiceId: 's1', libelle: 'Oct', montantAttendu: 10000, montantPaye: 0, dateEcheance: d(2026, 9), statut: 'en_retard' },
        { souscriptionServiceId: 's1', libelle: 'Nov', montantAttendu: 10000, montantPaye: 0, dateEcheance: d(2026, 10), statut: 'en_attente' },
        { souscriptionServiceId: 's1', libelle: 'Déc', montantAttendu: 10000, montantPaye: 4000, dateEcheance: d(2026, 11), statut: 'en_attente' },
        { souscriptionServiceId: 's1', libelle: 'Jan', montantAttendu: 10000, montantPaye: 0, dateEcheance: d(2027, 0), statut: 'en_attente' },
      ],
    });
    await arreterService(tx, 't1', tx.state.souscription, { maintenant: new Date(Date.UTC(2026, 10, 20)) });
    const [oct, nov, dec, jan] = tx.state.echeances;
    expect(oct.montantAttendu).toBe(10000);
    expect(nov.montantAttendu).toBe(10000);
    expect(dec).toMatchObject({ montantAttendu: 4000, statut: 'payee' });
    expect(jan).toMatchObject({ montantAttendu: 0, statut: 'annulee' });
    expect(tx.state.souscription.actif).toBe(false);
  });

  it('tarif spécial en cours : périodes non soldées à partir du mois courant, jamais sous le déjà payé', async () => {
    const d = (m) => new Date(Date.UTC(2026, m, 5, 12));
    const tx = fakeTx({
      souscription: { id: 's1', actif: true },
      echeances: [
        { souscriptionServiceId: 's1', libelle: 'Oct', montantAttendu: 10000, montantPaye: 0, dateEcheance: d(9), statut: 'en_retard' },
        { souscriptionServiceId: 's1', libelle: 'Nov', montantAttendu: 10000, montantPaye: 7000, dateEcheance: d(10), statut: 'en_attente' },
        { souscriptionServiceId: 's1', libelle: 'Déc', montantAttendu: 10000, montantPaye: 0, dateEcheance: d(11), statut: 'en_attente' },
      ],
    });
    await modifierTarifService(tx, 't1', tx.state.souscription, cantine, {
      tarif: 5000, motifTarifSpecial: 'Famille en difficulté', maintenant: new Date(Date.UTC(2026, 10, 10)),
    });
    const [oct, nov, dec] = tx.state.echeances;
    expect(oct.montantAttendu).toBe(10000);
    expect(nov).toMatchObject({ montantAttendu: 7000, statut: 'payee' });
    expect(dec.montantAttendu).toBe(5000);
    expect(tx.state.souscription).toMatchObject({ tarifApplique: 5000, tarifSpecial: true });
  });
});
