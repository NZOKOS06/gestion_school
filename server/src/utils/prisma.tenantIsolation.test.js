import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  rawPrisma,
  asyncLocalStorage,
  TENANT_MODELS,
} from './prisma.js';

/** Modèles Prisma avec tenantId requis (ou AuditLog optionnel mais isolé en contexte école). */
const EXPECTED_ISOLATED = [
  'TenantConfig',
  'TenantJourEcole',
  'TenantIpWhitelist',
  'Staff',
  'User',
  'CookieConsent',
  'AnneeScolaire',
  'ReferentielVersion',
  'NiveauOfficiel',
  'FiliereOfficielle',
  'PeriodeScolaire',
  'Classe',
  'Matiere',
  'MatiereNiveauAnnee',
  'MatiereClasseAnnee',
  'Eleve',
  'EnseignantClasse',
  'EnseignantClasseQuittee',
  'Inscription',
  'Echeance',
  'Evaluation',
  'Note',
  'Bulletin',
  'EmploiDuTemps',
  'Absence',
  'Sanction',
  'Paiement',
  'Depense',
  'Certificat',
  'Notification',
  'Actualite',
  'AuditLog',
  'Salle',
  'CalendrierScolaire',
  'CahierDeTextes',
  'ConseilDeClasse',
  'HeureEnseignee',
  'Message',
  'ExamenSession',
  'ExamenCandidature',
  'ResultatExamen',
];

const SLUG_A = 'iso-tenant-a';
const SLUG_B = 'iso-tenant-b';

describe('TENANT_MODELS completeness', () => {
  it('includes every expected tenant-scoped model', () => {
    for (const model of EXPECTED_ISOLATED) {
      expect(TENANT_MODELS.has(model), `missing ${model}`).toBe(true);
    }
  });

  it('does not isolate token / child models without tenant scope', () => {
    for (const model of [
      'RefreshToken',
      'PasswordResetToken',
      'EmailVerificationToken',
      'BulletinDetail',
      'ConseilParticipant',
      'ExamenNote',
      'Tenant',
    ]) {
      expect(TENANT_MODELS.has(model), `should not isolate ${model}`).toBe(false);
    }
  });
});

describe('extendedPrisma cross-tenant isolation (integration)', () => {
  let tenantA;
  let tenantB;

  beforeAll(async () => {
    await cleanup();

    tenantA = await rawPrisma.tenant.create({
      data: {
        nom: 'Isolation School A',
        slug: SLUG_A,
        actif: true,
        config: { create: { nomEcole: 'School A' } },
      },
    });
    tenantB = await rawPrisma.tenant.create({
      data: {
        nom: 'Isolation School B',
        slug: SLUG_B,
        actif: true,
        config: { create: { nomEcole: 'School B' } },
      },
    });

    await rawPrisma.actualite.createMany({
      data: [
        {
          tenantId: tenantA.id,
          titre: 'Secret A',
          contenu: 'visible only A',
          publique: true,
        },
        {
          tenantId: tenantB.id,
          titre: 'Secret B',
          contenu: 'visible only B',
          publique: true,
        },
      ],
    });

    await rawPrisma.message.createMany({
      data: [
        {
          tenantId: tenantA.id,
          sujet: 'Msg A',
          contenu: 'private A',
        },
        {
          tenantId: tenantB.id,
          sujet: 'Msg B',
          contenu: 'private B',
        },
      ],
    });

    const staffA = await rawPrisma.staff.create({
      data: {
        tenantId: tenantA.id,
        email: `dir+${SLUG_A}@iso.test`,
        passwordHash: 'x',
        nom: 'A',
        prenom: 'Dir',
        role: 'directeur',
        actif: true,
      },
    });
    const staffB = await rawPrisma.staff.create({
      data: {
        tenantId: tenantB.id,
        email: `dir+${SLUG_B}@iso.test`,
        passwordHash: 'x',
        nom: 'B',
        prenom: 'Dir',
        role: 'directeur',
        actif: true,
      },
    });

    await rawPrisma.depense.createMany({
      data: [
        {
          tenantId: tenantA.id,
          categorie: 'fournitures',
          motif: 'Depense A',
          montant: 1000,
          saisieParId: staffA.id,
        },
        {
          tenantId: tenantB.id,
          categorie: 'fournitures',
          motif: 'Depense B',
          montant: 2000,
          saisieParId: staffB.id,
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  async function cleanup() {
    for (const slug of [SLUG_A, SLUG_B]) {
      const t = await rawPrisma.tenant.findUnique({ where: { slug } });
      if (!t) continue;
      await rawPrisma.depense.deleteMany({ where: { tenantId: t.id } });
      await rawPrisma.message.deleteMany({ where: { tenantId: t.id } });
      await rawPrisma.actualite.deleteMany({ where: { tenantId: t.id } });
      await rawPrisma.staff.deleteMany({ where: { tenantId: t.id } });
      await rawPrisma.tenantConfig.deleteMany({ where: { tenantId: t.id } });
      await rawPrisma.tenant.delete({ where: { id: t.id } });
    }
  }

  it('findMany Actualite ne fuit pas vers l’autre tenant', async () => {
    const rows = await asyncLocalStorage.run({ tenantId: tenantA.id }, async () =>
      prisma.actualite.findMany()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].titre).toBe('Secret A');
    expect(rows.every((r) => r.tenantId === tenantA.id)).toBe(true);
  });

  it('findMany Message ne fuit pas vers l’autre tenant', async () => {
    const rows = await asyncLocalStorage.run({ tenantId: tenantB.id }, async () =>
      prisma.message.findMany()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].sujet).toBe('Msg B');
  });

  it('findMany Depense (ex-whitelist manquante) reste isolé', async () => {
    const rows = await asyncLocalStorage.run({ tenantId: tenantA.id }, async () =>
      prisma.depense.findMany()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].motif).toBe('Depense A');
  });

  it('count respecte le tenant ALS', async () => {
    const n = await asyncLocalStorage.run({ tenantId: tenantA.id }, async () =>
      prisma.message.count()
    );
    expect(n).toBe(1);
  });

  it('sans ALS, extendedPrisma ne filtre pas (comportement documenté)', async () => {
    const rows = await prisma.actualite.findMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
