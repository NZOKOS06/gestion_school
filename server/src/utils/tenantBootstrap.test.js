import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rawPrisma } from './prisma.js';
import { bootstrapTenantReferentiel } from './tenantBootstrap.js';

const SLUG = 'bootstrap-idem';

describe('bootstrap d\'une école : idempotent et semé une seule fois', () => {
  let tenant;
  const compter = async () => ({
    matieres: await rawPrisma.matiere.count({ where: { tenantId: tenant.id } }),
    annees: await rawPrisma.anneeScolaire.count({ where: { tenantId: tenant.id } }),
    niveaux: await rawPrisma.niveauOfficiel.count({ where: { tenantId: tenant.id } }),
    periodes: await rawPrisma.periodeScolaire.count({ where: { tenantId: tenant.id } }),
  });

  beforeAll(async () => {
    await rawPrisma.tenant.deleteMany({ where: { slug: SLUG } });
    tenant = await rawPrisma.tenant.create({ data: { nom: SLUG, slug: SLUG, config: { create: { nomEcole: SLUG } } } });
  });
  afterAll(() => rawPrisma.tenant.deleteMany({ where: { slug: SLUG } }));

  it('crée le socle une fois, sans doublon en cas de rappel ni d\'appels simultanés', async () => {
    await Promise.all([bootstrapTenantReferentiel(tenant.id, rawPrisma), bootstrapTenantReferentiel(tenant.id, rawPrisma)]);
    const premier = await compter();
    expect(premier.matieres).toBeGreaterThan(0);
    expect(premier.annees).toBe(1);
    expect(premier.niveaux).toBeGreaterThan(0);

    await bootstrapTenantReferentiel(tenant.id, rawPrisma);
    expect(await compter()).toEqual(premier);
  });

  it('l\'année de départ est l\'année scolaire en cours', async () => {
    const annee = await rawPrisma.anneeScolaire.findFirst({ where: { tenantId: tenant.id } });
    const now = new Date();
    const debut = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    expect(annee.libelle).toBe(`${debut}-${debut + 1}`);
  });

  it('ne recrée jamais ce que l\'école a supprimé', async () => {
    await rawPrisma.matiere.deleteMany({ where: { tenantId: tenant.id } });
    await rawPrisma.periodeScolaire.deleteMany({ where: { tenantId: tenant.id } });
    await rawPrisma.anneeScolaire.deleteMany({ where: { tenantId: tenant.id } });
    await bootstrapTenantReferentiel(tenant.id, rawPrisma);
    const apres = await compter();
    expect(apres.matieres).toBe(0);
    expect(apres.annees).toBe(0);
  });
});
