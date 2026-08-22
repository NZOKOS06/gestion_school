import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rawPrisma } from './prisma.js';
import { ensureSingleActiveYear, countActiveYears } from './anneeActive.js';

const SLUG = 'annee-active-smoke';

describe('ensureSingleActiveYear', () => {
  let tenant;
  let y1;
  let y2;
  let yBrouillon;

  beforeAll(async () => {
    await cleanup();
    tenant = await rawPrisma.tenant.create({
      data: {
        nom: 'Annee Active School',
        slug: SLUG,
        actif: true,
        config: { create: { nomEcole: 'Annee Active' } },
      },
    });

    y1 = await rawPrisma.anneeScolaire.create({
      data: {
        tenantId: tenant.id,
        libelle: '2024-2025',
        dateDebut: new Date('2024-09-01'),
        dateFin: new Date('2025-06-30'),
        statut: 'active',
        actif: true,
      },
    });
    y2 = await rawPrisma.anneeScolaire.create({
      data: {
        tenantId: tenant.id,
        libelle: '2025-2026',
        dateDebut: new Date('2025-09-01'),
        dateFin: new Date('2026-06-30'),
        statut: 'brouillon',
        actif: false,
      },
    });
    yBrouillon = await rawPrisma.anneeScolaire.create({
      data: {
        tenantId: tenant.id,
        libelle: '2026-2027',
        dateDebut: new Date('2026-09-01'),
        dateFin: new Date('2027-06-30'),
        statut: 'brouillon',
        actif: false,
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  async function cleanup() {
    const t = await rawPrisma.tenant.findUnique({ where: { slug: SLUG } });
    if (!t) return;
    await rawPrisma.anneeScolaire.deleteMany({ where: { tenantId: t.id } });
    await rawPrisma.tenantConfig.deleteMany({ where: { tenantId: t.id } });
    await rawPrisma.tenant.delete({ where: { id: t.id } });
  }

  it('n’active qu’une année et archive l’ancienne active', async () => {
    await rawPrisma.$transaction((tx) =>
      ensureSingleActiveYear(tx, tenant.id, y2.id)
    );

    const years = await rawPrisma.anneeScolaire.findMany({
      where: { tenantId: tenant.id },
      orderBy: { libelle: 'asc' },
    });
    const map = Object.fromEntries(years.map((y) => [y.libelle, y]));

    expect(map['2025-2026'].statut).toBe('active');
    expect(map['2025-2026'].actif).toBe(true);
    expect(map['2024-2025'].statut).toBe('archivee');
    expect(map['2024-2025'].actif).toBe(false);
    expect(map['2026-2027'].statut).toBe('brouillon');
    expect(map['2026-2027'].actif).toBe(false);

    expect(await countActiveYears(rawPrisma, tenant.id)).toBe(1);

    const cfg = await rawPrisma.tenantConfig.findUnique({ where: { tenantId: tenant.id } });
    expect(cfg.anneeScolaireActiveId).toBe(y2.id);
  });

  it('refuse une année d’un autre tenant', async () => {
    await expect(
      rawPrisma.$transaction((tx) =>
        ensureSingleActiveYear(tx, 'fake-tenant', yBrouillon.id)
      )
    ).rejects.toThrow(/ANNEE_NOT_FOUND/);
  });
});
