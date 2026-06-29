import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const TEST_TENANT_SLUG = `test-integration-${Date.now()}`

export let testTenant, testPharmacien, testVendeur, testCaissier
export let testMedicament, testLot, testFournisseur

export async function setupTestDB() {
  await teardownTestDB()

  testTenant = await prisma.tenant.create({
    data: {
      nom: 'Pharmacie Test Integration',
      slug: TEST_TENANT_SLUG,
      plan: 'basique',
      actif: true,
      contact: {},
      config: {
        create: {
          nomApp: 'GestPharma Test',
          couleurPrimaire: '#16A34A',
          couleurSecondaire: '#15803D',
          couleurTexte: '#1f2937',
          devise: 'FCFA',
          tauxTVA: 0,
          seuilAlerteStock: 5,
          joursAlertePeremption: 90,
          moduleVentes: true,
          moduleStock: true,
          moduleCatalogue: true,
          moduleOrdonnances: true,
          moduleFournisseurs: true,
          modulePersonnel: true,
        }
      }
    },
    include: { config: true }
  })

  const hash = await bcrypt.hash('Test123!@#', 12)

  testPharmacien = await prisma.staff.create({
    data: {
      tenantId: testTenant.id,
      nom: 'Dupont',
      prenom: 'Marie',
      email: `pharmacien+${TEST_TENANT_SLUG}@test.cg`,
      passwordHash: hash,
      role: 'pharmacien',
      actif: true,
      mustChangePassword: false,
    }
  })

  testVendeur = await prisma.staff.create({
    data: {
      tenantId: testTenant.id,
      nom: 'Mbemba',
      prenom: 'Jean',
      email: `vendeur+${TEST_TENANT_SLUG}@test.cg`,
      passwordHash: hash,
      role: 'vendeur',
      actif: true,
      mustChangePassword: false,
    }
  })

  testCaissier = await prisma.staff.create({
    data: {
      tenantId: testTenant.id,
      nom: 'Loemba',
      prenom: 'Paul',
      email: `caissier+${TEST_TENANT_SLUG}@test.cg`,
      passwordHash: hash,
      role: 'caissier',
      actif: true,
      mustChangePassword: false,
    }
  })

  testFournisseur = await prisma.fournisseur.create({
    data: {
      tenantId: testTenant.id,
      nom: 'Grossiste Test',
      telephone: '06 00 00 00 00',
      email: `grossiste+${TEST_TENANT_SLUG}@test.cg`,
    }
  })

  testMedicament = await prisma.medicament.create({
    data: {
      tenantId: testTenant.id,
      dci: 'Paracétamol',
      nomCommercial: 'Doliprane 500mg',
      formeGalenique: 'comprime',
      dosage: '500mg',
      conditionnement: 'Boîte 16',
      prixAchat: 500,
      prixVente: 800,
      margePercent: 60,
      ordonnanceRequise: false,
      stockTotal: 0,
      seuilAlerte: 5,
      actif: true,
    }
  })

  testLot = await prisma.lotStock.create({
    data: {
      tenantId: testTenant.id,
      medicamentId: testMedicament.id,
      numeroLot: 'LOT-TEST-001',
      datePeremption: new Date(Date.now() + 365 * 86400000),
      quantiteInitiale: 100,
      quantiteRestante: 100,
      prixAchatLot: 500,
    }
  })

  await prisma.medicament.update({
    where: { id: testMedicament.id },
    data: { stockTotal: 100 }
  })

  return { testTenant, testPharmacien, testVendeur, testCaissier, testMedicament, testLot, testFournisseur }
}

export async function teardownTestDB() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TEST_TENANT_SLUG } })
  if (!tenant) return

  const tid = tenant.id
  await prisma.mouvementStock.deleteMany({ where: { tenantId: tid } })
  await prisma.ligneVente.deleteMany({ where: { vente: { tenantId: tid } } })
  await prisma.paymentTransaction.deleteMany({ where: { vente: { tenantId: tid } } })
  await prisma.vente.deleteMany({ where: { tenantId: tid } })
  await prisma.ligneOrdonnance.deleteMany({ where: { ordonnance: { tenantId: tid } } })
  await prisma.ordonnance.deleteMany({ where: { tenantId: tid } })
  await prisma.lotStock.deleteMany({ where: { tenantId: tid } })
  await prisma.ligneCommandeF.deleteMany({ where: { commande: { tenantId: tid } } })
  await prisma.commandeFournisseur.deleteMany({ where: { tenantId: tid } })
  await prisma.medicament.deleteMany({ where: { tenantId: tid } })
  await prisma.fournisseur.deleteMany({ where: { tenantId: tid } })
  await prisma.refreshToken.deleteMany({ where: { userId: { in: (await prisma.staff.findMany({ where: { tenantId: tid }, select: { id: true } })).map(s => s.id) } } })
  await prisma.staff.deleteMany({ where: { tenantId: tid } })
  await prisma.tenantConfig.deleteMany({ where: { tenantId: tid } })
  await prisma.tenant.deleteMany({ where: { id: tid } })

  await prisma.$disconnect()
}

export { prisma as testPrisma }
