import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { rawPrisma } from '../utils/prisma.js';
import { login } from './auth.controller.js';

const SLUG = 'login-tel';
const res = () => {
  const r = { code: 200, body: null, cookies: [] };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.cookie = (n) => { r.cookies.push(n); return r; };
  return r;
};

describe('connexion parent par numéro de téléphone', () => {
  let tenant;
  const tenter = async (identifiant, password = 'ParentTest123!') => {
    const r = res();
    await login({ body: { email: identifiant, password }, tenantId: tenant.id, tenant, headers: {}, ip: '127.0.0.1' }, r);
    return r;
  };

  beforeAll(async () => {
    await rawPrisma.tenant.deleteMany({ where: { slug: SLUG } });
    tenant = await rawPrisma.tenant.create({ data: { nom: SLUG, slug: SLUG, config: { create: { nomEcole: SLUG, moduleParents: true } } } });
    await rawPrisma.user.create({
      data: {
        tenantId: tenant.id, nom: 'Parent', prenom: 'Tel', email: `parent_242061234567@${SLUG}.cg`, telephone: '+242 06 123 45 67',
        passwordHash: await bcrypt.hash('ParentTest123!', 10), portailActif: true, mustChangePassword: false,
      },
    });
  });
  afterAll(() => rawPrisma.tenant.deleteMany({ where: { slug: SLUG } }));

  it.each(['+242 06 123 45 67', '+242061234567', '06 123 45 67', '061234567'])('accepte le numéro saisi « %s »', async (saisie) => {
    const r = await tenter(saisie);
    expect(r.code).toBe(200);
    expect(r.cookies).toContain('accessToken');
  });

  it('refuse un mauvais mot de passe et un numéro inconnu', async () => {
    expect((await tenter('061234567', 'mauvais')).code).toBe(401);
    expect((await tenter('069999999')).code).toBe(401);
  });
});
