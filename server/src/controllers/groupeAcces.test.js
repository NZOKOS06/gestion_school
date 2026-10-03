import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rawPrisma } from '../utils/prisma.js';
import { monGroupe, mesSites, changerSite, accorderAcces, retirerAcces, listerAcces } from './groupeEcole.controller.js';

const P = 'grp-acces';
const res = () => {
  const r = { code: 200, body: null, cookies: [] };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.cookie = (n) => { r.cookies.push(n); return r; };
  return r;
};

describe('groupe scolaire : accès délégués et navigation entre sites', () => {
  let groupe, A, B, dirA, secA, enseignantB;

  const nettoyer = async () => {
    await rawPrisma.tenant.deleteMany({ where: { slug: { startsWith: P } } });
    await rawPrisma.groupeScolaire.deleteMany({ where: { nom: P } });
  };
  const reqDe = (tenant, staff, body = {}, params = {}) => ({
    tenantId: tenant.id, user: { id: staff.id, origineStaffId: staff.origineStaffId || null }, body, params,
  });

  beforeAll(async () => {
    await nettoyer();
    groupe = await rawPrisma.groupeScolaire.create({ data: { nom: P } });
    const mk = async (s) => rawPrisma.tenant.create({ data: { nom: `${P}-${s}`, slug: `${P}-${s}`, groupeId: groupe.id, config: { create: { nomEcole: s } } } });
    A = await mk('a'); B = await mk('b');
    const staff = (tenant, email, role) => rawPrisma.staff.create({ data: { tenantId: tenant.id, email, passwordHash: 'x', nom: 'N', prenom: role, role } });
    dirA = await staff(A, `dir@${P}.cg`, 'directeur');
    secA = await staff(A, `sec@${P}.cg`, 'secretaire');
    enseignantB = await staff(B, `ens@${P}.cg`, 'enseignant');
    await rawPrisma.groupeScolaire.update({ where: { id: groupe.id }, data: { directeurStaffId: dirA.id } });
  });

  afterAll(nettoyer);

  it('sans autorisation, un membre du personnel ne peut pas changer de site', async () => {
    const r = res(); await changerSite(reqDe(A, secA, { tenantId: B.id }), r);
    expect(r.code).toBe(403);
    const r2 = res(); await mesSites(reqDe(A, secA), r2);
    expect(r2.body.data).toEqual([]);
  });

  it('le directeur de groupe navigue vers un autre site via un compte miroir', async () => {
    const r = res(); await changerSite(reqDe(A, dirA, { tenantId: B.id }), r);
    expect(r.code).toBe(200);
    expect(r.body.data.slug).toBe(`${P}-b`);
    expect(r.cookies).toContain('accessToken');
    const miroir = await rawPrisma.staff.findFirst({ where: { tenantId: B.id, origineStaffId: dirA.id } });
    expect(miroir).toMatchObject({ role: 'directeur', email: dirA.email, actif: true });

    // Depuis le miroir : même identité, il se reconnaît directeur de groupe et peut revenir
    const r2 = res(); await monGroupe(reqDe(B, miroir), r2);
    expect(r2.body.data.estDirecteurGroupe).toBe(true);
    const r3 = res(); await changerSite(reqDe(B, miroir, { tenantId: A.id }), r3);
    expect(r3.body.data.slug).toBe(`${P}-a`);
    // Un deuxième passage ne duplique pas le miroir
    const r4 = res(); await changerSite(reqDe(A, dirA, { tenantId: B.id }), r4);
    expect(await rawPrisma.staff.count({ where: { tenantId: B.id, origineStaffId: dirA.id } })).toBe(1);
  });

  it('le directeur de groupe autorise une secrétaire, puis lui retire l\'accès', async () => {
    const l = res(); await listerAcces(reqDe(A, dirA), l);
    expect(l.body.candidats.map((c) => c.id)).toContain(secA.id);
    expect(l.body.candidats.map((c) => c.id)).not.toContain(enseignantB.id);

    const r = res(); await accorderAcces(reqDe(A, dirA, { staffId: secA.id, role: 'secretaire' }), r);
    expect(r.code).toBe(201);
    const s = res(); await mesSites(reqDe(A, secA), s);
    expect(s.body.data).toHaveLength(2);

    const c = res(); await changerSite(reqDe(A, secA, { tenantId: B.id }), c);
    expect(c.code).toBe(200);
    const miroir = await rawPrisma.staff.findFirst({ where: { tenantId: B.id, origineStaffId: secA.id } });
    expect(miroir.role).toBe('secretaire');

    const d = res(); await retirerAcces(reqDe(A, dirA, {}, { id: r.body.data.id }), d);
    expect(d.code).toBe(200);
    expect((await rawPrisma.staff.findUnique({ where: { id: miroir.id } })).actif).toBe(false);
    const e = res(); await changerSite(reqDe(A, secA, { tenantId: B.id }), e);
    expect(e.code).toBe(403);
  });

  it('refuse d\'accorder un accès à un enseignant ou à un rôle invalide, et à qui n\'est pas directeur de groupe', async () => {
    const r = res(); await accorderAcces(reqDe(A, dirA, { staffId: enseignantB.id, role: 'secretaire' }), r);
    expect(r.code).toBe(404);
    const r2 = res(); await accorderAcces(reqDe(A, dirA, { staffId: secA.id, role: 'super_admin' }), r2);
    expect(r2.code).toBe(400);
    const r3 = res(); await accorderAcces(reqDe(A, secA, { staffId: secA.id, role: 'secretaire' }), r3);
    expect(r3.code).toBe(403);
  });

  it('refuse le changement de site si un compte de même e-mail existe déjà sur le site cible', async () => {
    await rawPrisma.groupeAcces.create({ data: { groupeId: groupe.id, staffId: secA.id, role: 'secretaire' } });
    await rawPrisma.staff.deleteMany({ where: { tenantId: B.id, origineStaffId: secA.id } });
    await rawPrisma.staff.create({ data: { tenantId: B.id, email: secA.email, passwordHash: 'x', nom: 'X', prenom: 'Y', role: 'secretaire' } });
    const r = res(); await changerSite(reqDe(A, secA, { tenantId: B.id }), r);
    expect(r.code).toBe(409);
  });
});
