/**
 * Helpers de setup pour tests d'intégration GestSchool.
 * Socle de test scolaire (suites legacy exclues de vitest).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TEST_TENANT_SLUG = 'test-school';

export let testTenant, testDirecteur, testEnseignant, testComptable;

export async function setupTestDb() {
  await cleanupTestDb();

  testTenant = await prisma.tenant.create({
    data: {
      nom: 'École Test Integration',
      slug: TEST_TENANT_SLUG,
      actif: true,
      config: {
        create: {
          nomEcole: 'GestSchool Test',
          couleurPrimaire: '#16A34A',
          moduleEleves: true,
          moduleClasses: true,
          moduleNotes: true,
          modulePaiements: true,
        },
      },
    },
    include: { config: true },
  });

  const hash = await bcrypt.hash('Test1234!', 10);

  testDirecteur = await prisma.staff.create({
    data: {
      tenantId: testTenant.id,
      email: `directeur+${TEST_TENANT_SLUG}@test.cg`,
      passwordHash: hash,
      nom: 'Test',
      prenom: 'Directeur',
      role: 'directeur',
      actif: true,
    },
  });

  testEnseignant = await prisma.staff.create({
    data: {
      tenantId: testTenant.id,
      email: `enseignant+${TEST_TENANT_SLUG}@test.cg`,
      passwordHash: hash,
      nom: 'Test',
      prenom: 'Enseignant',
      role: 'enseignant',
      actif: true,
    },
  });

  testComptable = await prisma.staff.create({
    data: {
      tenantId: testTenant.id,
      email: `comptable+${TEST_TENANT_SLUG}@test.cg`,
      passwordHash: hash,
      nom: 'Test',
      prenom: 'Comptable',
      role: 'comptable',
      actif: true,
    },
  });

  return { testTenant, testDirecteur, testEnseignant, testComptable };
}

export async function cleanupTestDb() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TEST_TENANT_SLUG } });
  if (!tenant) return;
  const tid = tenant.id;

  await prisma.auditLog.deleteMany({ where: { tenantId: tid } });
  await prisma.paiement.deleteMany({ where: { tenantId: tid } });
  await prisma.staff.deleteMany({ where: { tenantId: tid } });
  await prisma.tenantConfig.deleteMany({ where: { tenantId: tid } });
  await prisma.tenant.delete({ where: { id: tid } });
}

export { prisma, TEST_TENANT_SLUG };
