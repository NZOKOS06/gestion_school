import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rawPrisma } from '../utils/prisma.js';
import { monGroupe, partagerTarifs, transfererEleve, statsMonGroupe } from './groupeEcole.controller.js';

const P = 'grp-test';
const res = () => {
  const r = { code: 200, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

describe('groupe scolaire : directeur de groupe, tarifs, transferts', () => {
  let groupe, A, B, dirA, dirB, classeA, classeB, eleve;

  const nettoyer = async () => {
    await rawPrisma.tenant.deleteMany({ where: { slug: { startsWith: P } } });
    await rawPrisma.groupeScolaire.deleteMany({ where: { nom: P } });
  };

  beforeAll(async () => {
    await nettoyer();
    groupe = await rawPrisma.groupeScolaire.create({ data: { nom: P } });
    const mk = async (suffixe) => {
      const t = await rawPrisma.tenant.create({ data: { nom: `${P}-${suffixe}`, slug: `${P}-${suffixe}`, groupeId: groupe.id } });
      const staff = await rawPrisma.staff.create({ data: { tenantId: t.id, email: `d@${P}-${suffixe}.cg`, passwordHash: 'x', nom: 'D', prenom: suffixe, role: 'directeur' } });
      const annee = await rawPrisma.anneeScolaire.create({ data: { tenantId: t.id, libelle: '2026-2027', dateDebut: new Date('2026-09-01'), dateFin: new Date('2027-06-30'), statut: 'active', actif: true } });
      return { t, staff, annee };
    };
    const a = await mk('a'); const b = await mk('b');
    A = a.t; B = b.t; dirA = a.staff; dirB = b.staff;
    const base = { nom: '6ème A', niveau: '6eme', cycle: 'college' };
    classeA = await rawPrisma.classe.create({ data: { ...base, tenantId: A.id, anneeScolaireId: a.annee.id, fraisScolarite: 90000, fraisInscription: 15000, fraisMensuel: 10000 } });
    classeB = await rawPrisma.classe.create({ data: { ...base, tenantId: B.id, anneeScolaireId: b.annee.id, fraisScolarite: 1 } });
    eleve = await rawPrisma.eleve.create({ data: { tenantId: A.id, matricule: `${P}-M1`, nom: 'Nzoko', prenom: 'Paul', dateNaissance: new Date('2015-01-01'), sexe: 'M' } });
    await rawPrisma.groupeScolaire.update({ where: { id: groupe.id }, data: { directeurStaffId: dirA.id } });
  });

  afterAll(async () => { await nettoyer(); await rawPrisma.eleve.deleteMany({ where: { matricule: { startsWith: P } } }); });

  const reqDe = (tenant, staff, body = {}) => ({ tenantId: tenant.id, user: { id: staff.id }, body, params: {} });

  it('identifie le directeur de groupe', async () => {
    const r1 = res(); await monGroupe(reqDe(A, dirA), r1);
    const r2 = res(); await monGroupe(reqDe(B, dirB), r2);
    expect(r1.body.data.estDirecteurGroupe).toBe(true);
    expect(r2.body.data.estDirecteurGroupe).toBe(false);
  });

  it('refuse un directeur qui n\'est pas directeur de groupe', async () => {
    const r = res(); await statsMonGroupe(reqDe(B, dirB), r);
    expect(r.code).toBe(403);
    const r2 = res(); await partagerTarifs(reqDe(B, dirB, { cibleTenantIds: [A.id] }), r2);
    expect(r2.code).toBe(403);
  });

  it('stats consolidées', async () => {
    const r = res(); await statsMonGroupe(reqDe(A, dirA), r);
    expect(r.body.sites).toHaveLength(2);
  });

  it('partage les tarifs vers les classes de même nom', async () => {
    const r = res(); await partagerTarifs(reqDe(A, dirA, { cibleTenantIds: [B.id, A.id, 'inconnu'] }), r);
    expect(r.body.data).toEqual([{ tenantId: B.id, classesMisesAJour: 1 }]);
    const b = await rawPrisma.classe.findUnique({ where: { id: classeB.id } });
    expect(Number(b.fraisScolarite)).toBe(90000);
    expect(Number(b.fraisInscription)).toBe(15000);
  });

  it('refuse un site hors groupe', async () => {
    const r = res(); await partagerTarifs(reqDe(A, dirA, { cibleTenantIds: ['inconnu'] }), r);
    expect(r.code).toBe(400);
  });

  it('transfère un élève : copie à l\'arrivée, archive à l\'origine', async () => {
    const r = res(); await transfererEleve(reqDe(A, dirA, { eleveId: eleve.id, cibleTenantId: B.id }), r);
    expect(r.code).toBe(201);
    const arrive = await rawPrisma.eleve.findFirst({ where: { tenantId: B.id, matricule: `${P}-M1` } });
    const origine = await rawPrisma.eleve.findUnique({ where: { id: eleve.id } });
    expect(arrive?.actif).toBe(true);
    expect(origine.actif).toBe(false);
    expect(origine.matricule).not.toBe(`${P}-M1`);
    const r2 = res(); await transfererEleve(reqDe(A, dirA, { eleveId: eleve.id, cibleTenantId: B.id }), r2);
    expect(r2.code).toBe(404);
  });
});
