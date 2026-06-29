import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: false })

// Données de test partagées
export const TEST_TENANT_SLUG = 'test-integration'
export let testTenant, testPharmacien, testVendeur, testCaissier
export let testMedicament, testLot, testFournisseur

const TEST_DB_URL = (() => {
  // Read .env.test directly to get the test DB URL before config.js overwrites DATABASE_URL
  const parsed = dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })
  return parsed.parsed?.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5432/gestpharma_test'
})()

let _prisma = null
function getPrisma() {
  if (!_prisma) {
    _prisma = new PrismaClient({
      datasources: { db: { url: TEST_DB_URL } }
    })
  }
  return _prisma
}

export async function setupTestDB() {
  const prisma = getPrisma()
  // Nettoyer dans l'ordre des dépendances
  await prisma.mouvementStock.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.paymentTransaction.deleteMany({ where: { vente: { tenant: { slug: TEST_TENANT_SLUG } } } })
  await prisma.ligneVente.deleteMany({ where: { vente: { tenant: { slug: TEST_TENANT_SLUG } } } })
  await prisma.vente.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.ligneOrdonnance.deleteMany({ where: { ordonnance: { tenant: { slug: TEST_TENANT_SLUG } } } })
  await prisma.ordonnance.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.ligneCommandeF.deleteMany({ where: { commande: { tenant: { slug: TEST_TENANT_SLUG } } } })
  await prisma.commandeFournisseur.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.lotStock.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.medicament.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.fournisseur.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.staff.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.tenantConfig.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.tenant.deleteMany({ where: { slug: TEST_TENANT_SLUG } })

  // Créer tenant de test
  testTenant = await prisma.tenant.create({
    data: {
      nom: 'Pharmacie Test',
      slug: TEST_TENANT_SLUG,
      plan: 'basique',
      actif: true,
      contact: {},
      config: {
        create: {
          nomApp: 'PharmacieTest',
          couleurPrimaire: '#16A34A',
          couleurSecondaire: '#15803D',
          couleurTexte: '#FFFFFF',
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

  // Créer staff de test
  const hash = await bcrypt.hash('Test123!@#', 12)

  testPharmacien = await prisma.staff.create({ data: {
    tenantId: testTenant.id,
    nom: 'Dupont',
    prenom: 'Marie',
    email: 'pharmacien@test.cg',
    passwordHash: hash,
    role: 'pharmacien',
    actif: true,
    mustChangePassword: false,
  }})

  testVendeur = await prisma.staff.create({ data: {
    tenantId: testTenant.id,
    nom: 'Mbemba',
    prenom: 'Jean',
    email: 'vendeur@test.cg',
    passwordHash: hash,
    role: 'vendeur',
    actif: true,
    mustChangePassword: false,
  }})

  testCaissier = await prisma.staff.create({ data: {
    tenantId: testTenant.id,
    nom: 'Loemba',
    prenom: 'Paul',
    email: 'caissier@test.cg',
    passwordHash: hash,
    role: 'caissier',
    actif: true,
    mustChangePassword: false,
  }})

  // Créer médicament de test
  testMedicament = await prisma.medicament.create({ data: {
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
  }})

  // Créer lot de stock
  testLot = await prisma.lotStock.create({ data: {
    tenantId: testTenant.id,
    medicamentId: testMedicament.id,
    numeroLot: 'LOT-TEST-001',
    datePeremption: new Date(Date.now() + 365 * 86400000),
    quantiteInitiale: 100,
    quantiteRestante: 100,
    prixAchatLot: 500,
  }})

  // Mettre à jour stockTotal
  await prisma.medicament.update({
    where: { id: testMedicament.id },
    data: { stockTotal: 100 }
  })

  testFournisseur = await prisma.fournisseur.create({ data: {
    tenantId: testTenant.id,
    nom: 'Grossiste Test',
    telephone: '06 00 00 00 00',
    email: 'grossiste@test.cg',
  }})
}

export async function teardownTestDB() {
  const prisma = getPrisma()
  // Même cleanup que setupTestDB
  await prisma.mouvementStock.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.paymentTransaction.deleteMany({ where: { vente: { tenant: { slug: TEST_TENANT_SLUG } } } })
  await prisma.ligneVente.deleteMany({ where: { vente: { tenant: { slug: TEST_TENANT_SLUG } } } })
  await prisma.vente.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.ligneOrdonnance.deleteMany({ where: { ordonnance: { tenant: { slug: TEST_TENANT_SLUG } } } })
  await prisma.ordonnance.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.ligneCommandeF.deleteMany({ where: { commande: { tenant: { slug: TEST_TENANT_SLUG } } } })
  await prisma.commandeFournisseur.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.lotStock.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.medicament.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.fournisseur.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.staff.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.tenantConfig.deleteMany({ where: { tenant: { slug: TEST_TENANT_SLUG } } })
  await prisma.tenant.deleteMany({ where: { slug: TEST_TENANT_SLUG } })
  await prisma.$disconnect()
}

export const testPrisma = new Proxy({}, {
  get(_, prop) {
    return getPrisma()[prop]
  }
})
