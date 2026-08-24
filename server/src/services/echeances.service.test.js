import { describe, it, expect } from 'vitest';
import {
  monthsInRange,
  resteAPayer,
  applyPaymentCascade,
  syncInscriptionSolde,
  normalizeModePaiement,
  libelleMois,
} from './echeances.service.js';

function fakeDb(echeances, inscription = { id: 'ins-1', soldeScolarite: 0 }) {
  const state = {
    echeances: echeances.map((e) => ({ ...e })),
    inscription: { ...inscription },
  };
  return {
    state,
    echeance: {
      findMany: async ({ where } = {}) =>
        state.echeances.filter(
          (e) =>
            (!where?.tenantId || e.tenantId === where.tenantId) &&
            (!where?.inscriptionId || e.inscriptionId === where.inscriptionId)
        ),
      findUnique: async ({ where }) =>
        state.echeances.find((e) => e.id === where.id) || null,
      update: async ({ where, data }) => {
        const e = state.echeances.find((x) => x.id === where.id);
        Object.assign(e, data);
        return e;
      },
    },
    inscription: {
      update: async ({ where, data }) => {
        if (where.id !== state.inscription.id) throw new Error('not found');
        Object.assign(state.inscription, data);
        return state.inscription;
      },
    },
  };
}

describe('echeances pure helpers', () => {
  it('monthsInRange couvre une année scolaire type', () => {
    const months = monthsInRange('2025-09-01', '2026-06-30');
    expect(months.length).toBe(10);
    expect(libelleMois(months[0])).toMatch(/Septembre 2025/);
  });

  it('normalizeModePaiement mappe les alias courants', () => {
    expect(normalizeModePaiement('momo')).toBe('mobile_money');
    expect(normalizeModePaiement('Espèces')).toBe('especes');
    expect(normalizeModePaiement('cash')).toBe('especes');
  });
});

describe('resteAPayer / cascade / syncInscriptionSolde', () => {
  const base = [
    {
      id: 'e1',
      tenantId: 't1',
      inscriptionId: 'ins-1',
      libelle: "Frais d'inscription",
      montantAttendu: 10000,
      montantPaye: 0,
      dateEcheance: new Date('2025-09-15'),
      statut: 'en_attente',
    },
    {
      id: 'e2',
      tenantId: 't1',
      inscriptionId: 'ins-1',
      libelle: 'Octobre 2025',
      montantAttendu: 20000,
      montantPaye: 0,
      dateEcheance: new Date('2025-10-05'),
      statut: 'en_attente',
    },
    {
      id: 'e3',
      tenantId: 't1',
      inscriptionId: 'ins-1',
      libelle: 'Novembre 2025',
      montantAttendu: 20000,
      montantPaye: 0,
      dateEcheance: new Date('2025-11-05'),
      statut: 'en_attente',
    },
  ];

  it('resteAPayer = somme (attendu − payé) bornée à 0', async () => {
    const db = fakeDb([
      { ...base[0], montantPaye: 10000 },
      { ...base[1], montantPaye: 5000 },
      base[2],
    ]);
    const reste = await resteAPayer(db, 't1', 'ins-1');
    expect(reste).toBe(35000);
  });

  it('applyPaymentCascade répartit chronologiquement', async () => {
    const db = fakeDb(base);
    const { allocations } = await applyPaymentCascade(db, 't1', 'ins-1', 25000);
    expect(allocations).toHaveLength(2);
    expect(allocations[0].montant).toBe(10000);
    expect(allocations[1].montant).toBe(15000);
    expect(db.state.echeances[0].statut).toBe('payee');
    expect(Number(db.state.echeances[1].montantPaye)).toBe(15000);
    const reste = await resteAPayer(db, 't1', 'ins-1');
    expect(reste).toBe(25000);
  });

  it('syncInscriptionSolde aligne le solde sur les échéances', async () => {
    const db = fakeDb(base, { id: 'ins-1', soldeScolarite: 999999 });
    await applyPaymentCascade(db, 't1', 'ins-1', 10000);
    const reste = await syncInscriptionSolde(db, 't1', 'ins-1');
    expect(reste).toBe(40000);
    expect(Number(db.state.inscription.soldeScolarite)).toBe(40000);
  });

  it('applyPaymentCascade isole l’avance sur une allocation dédiée', async () => {
    const db = fakeDb([
      {
        id: 'e1',
        tenantId: 't1',
        inscriptionId: 'ins-1',
        libelle: 'Octobre 2025',
        montantAttendu: 10000,
        montantPaye: 0,
        dateEcheance: new Date('2025-10-05'),
        statut: 'en_attente',
      },
    ]);
    const { allocations } = await applyPaymentCascade(db, 't1', 'ins-1', 15000);
    expect(allocations).toHaveLength(2);
    expect(allocations[0].montant).toBe(10000);
    expect(allocations[1].avance).toBe(5000);
    expect(allocations[1].libelle).toMatch(/^Avance/);
    expect(Number(db.state.echeances[0].montantPaye)).toBe(15000);
  });
});
