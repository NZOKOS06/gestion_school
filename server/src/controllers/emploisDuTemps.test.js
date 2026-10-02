import { describe, it, expect, beforeEach, vi } from 'vitest';

const db = vi.hoisted(() => ({
  emplois: [],
  creneaux: [],
  created: null,
}));

vi.mock('../utils/prisma.js', () => {
  const matchCreneau = (where) => (c) => c.tenantId === where.tenantId && (c.cycle ?? null) === (where.cycle ?? null);
  const prisma = {
    classe: { findFirst: async () => ({ cycle: 'college' }) },
    enseignantClasse: { findFirst: async () => null },
    emploiDuTemps: {
      findMany: async ({ where }) => db.emplois.filter((e) => e.jourSemaine === where.jourSemaine
        && (!where.id || e.id !== where.id.not)
        && where.OR.some((cond) => Object.entries(cond).every(([k, v]) => e[k] === v))),
      findFirst: async ({ where }) => db.emplois.find((e) => e.id === where.id) || null,
      create: async ({ data }) => { db.created = { id: 'new', ...data }; return db.created; },
      update: async ({ where, data }) => ({ id: where.id, ...data }),
    },
    creneauHoraire: {
      findMany: async ({ where }) => db.creneaux.filter(matchCreneau(where)),
      deleteMany: async ({ where }) => { db.creneaux = db.creneaux.filter((c) => !matchCreneau(where)(c)); },
      createMany: async ({ data }) => { db.creneaux.push(...data); },
    },
  };
  prisma.$transaction = async (fn) => fn(prisma);
  return { prisma, rawPrisma: prisma };
});
vi.mock('../utils/auditLogger.js', () => ({ logAudit: vi.fn() }));

const { create, update, saveCreneaux } = await import('./emploisDuTemps.controller.js');

const mockRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

const cours = (over = {}) => ({
  tenantId: 't1', classeId: 'c1', matiereId: 'm1', enseignantId: 'p1', salleId: null,
  jourSemaine: 1, heureDebut: '07:10', heureFin: '07:45', ...over,
});

const call = async (fn, body, params = {}) => {
  const res = mockRes();
  await fn({ tenantId: 't1', body, params }, res);
  return res;
};

describe('emploi du temps — conflits', () => {
  beforeEach(() => {
    db.emplois = [{ id: 'e1', ...cours(), classe: { nom: '6e A' }, matiere: { nom: 'Maths' } }];
    db.creneaux = [{ tenantId: 't1', cycle: null, heureDebut: '09:50', heureFin: '10:10', type: 'recreation', libelle: 'Récréation' }];
    db.created = null;
  });

  it('accepte un cours contigu (07:45-08:10) pour le même enseignant', async () => {
    const res = await call(create, cours({ heureDebut: '07:45', heureFin: '08:10' }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('accepte les mêmes horaires un autre jour', async () => {
    const res = await call(create, cours({ jourSemaine: 2 }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('refuse le même enseignant, même jour, horaires qui se chevauchent dans une autre classe', async () => {
    const res = await call(create, cours({ classeId: 'c2', matiereId: 'm2', heureDebut: '07:30', heureFin: '08:00' }));
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toMatch(/enseignant/);
  });

  it('refuse un cours qui englobe un cours existant de la classe', async () => {
    const res = await call(create, cours({ enseignantId: 'p2', heureDebut: '07:00', heureFin: '09:00' }));
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('refuse un cours sur la récréation', async () => {
    const res = await call(create, cours({ enseignantId: 'p2', heureDebut: '09:30', heureFin: '10:00' }));
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toMatch(/récréation/i);
  });

  it('contrôle aussi les conflits en modification (sans se compter lui-même)', async () => {
    db.emplois.push({ id: 'e2', ...cours({ heureDebut: '08:00', heureFin: '09:00' }) });
    const ok = await call(update, { heureDebut: '07:10', heureFin: '07:50' }, { id: 'e1' });
    expect(ok.status).not.toHaveBeenCalled();
    const ko = await call(update, { heureDebut: '07:10', heureFin: '08:30' }, { id: 'e1' });
    expect(ko.status).toHaveBeenCalledWith(409);
  });
});

describe('grille horaire', () => {
  beforeEach(() => { db.creneaux = []; });

  it('enregistre des créneaux triés et normalisés', async () => {
    const res = await call(saveCreneaux, {
      cycle: 'college',
      creneaux: [
        { heureDebut: '7:45', heureFin: '8:10', type: 'cours' },
        { heureDebut: '07:10', heureFin: '07:45', type: 'cours' },
      ],
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(db.creneaux.map((c) => c.heureDebut)).toEqual(['07:10', '07:45']);
    expect(db.creneaux.every((c) => c.cycle === 'college')).toBe(true);
  });

  it('refuse des créneaux qui se chevauchent', async () => {
    const res = await call(saveCreneaux, {
      creneaux: [
        { heureDebut: '07:10', heureFin: '07:50' },
        { heureDebut: '07:45', heureFin: '08:10' },
      ],
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
