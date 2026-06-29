import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../index.js'
import { setupTestDB, teardownTestDB, TEST_TENANT_SLUG, testPharmacien, testMedicament, testFournisseur, testPrisma } from './setup.js'

let pharmacienToken, commandeId, ligneId

beforeAll(async () => {
  await setupTestDB()
})
afterAll(async () => {
  await teardownTestDB()
})

describe('FLUX APPROVISIONNEMENT — Commande fournisseur', () => {

  it('ÉTAPE 1 — Pharmacien se connecte', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({ email: testPharmacien.email, password: 'Test123!@#' })

    expect(res.status).toBe(200)
    pharmacienToken = res.headers['set-cookie'].find(c => c.startsWith('accessToken'))
  })

  it('ÉTAPE 2 — Créer commande fournisseur (brouillon)', async () => {
    const res = await request(app)
      .post('/api/commandes-fournisseurs')
      .set('Cookie', pharmacienToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({
        fournisseurId: testFournisseur.id,
        lignes: [
          {
            medicamentId: testMedicament.id,
            quantite: 50,
            prixUnitaire: 450
          }
        ],
        notes: 'Commande test d\'intégration'
      })

    expect(res.status).toBe(201)
    expect(res.body).toBeDefined()

    commandeId = res.body.id
    ligneId = res.body.lignes?.[0]?.id

    expect(res.body.statut).toBe('brouillon')
    expect(res.body.numeroCommande).toBeDefined()
    expect(res.body.lignes).toHaveLength(1)
    expect(parseFloat(res.body.montantTotal)).toBe(22500) // 50 × 450
  })

  it('ÉTAPE 3 — Envoyer la commande', async () => {
    const res = await request(app)
      .put(`/api/commandes-fournisseurs/${commandeId}/statut`)
      .set('Cookie', pharmacienToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({ statut: 'envoyee' })

    expect(res.status).toBe(200)
    expect(res.body.statut).toBe('envoyee')

    // Vérifier en DB
    const cmd = await testPrisma.commandeFournisseur.findUnique({ where: { id: commandeId } })
    expect(cmd.statut).toBe('envoyee')
  })

  it('ÉTAPE 4 — Réceptionner la commande → lot créé automatiquement', async () => {
    const datePeremption = new Date(Date.now() + 730 * 86400000).toISOString().split('T')[0] // +2 ans

    const res = await request(app)
      .post(`/api/commandes-fournisseurs/${commandeId}/reception`)
      .set('Cookie', pharmacienToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({
        dateReception: new Date().toISOString().split('T')[0],
        lignes: [
          {
            ligneId: ligneId,
            quantiteRecue: 50,
            numeroLot: 'LOT-NEW-001',
            datePeremption: datePeremption,
            prixAchatLot: 450
          }
        ]
      })

    expect(res.status).toBe(200)
    expect(res.body.lotsCrees).toBeDefined()
    expect(res.body.lotsCrees.length).toBeGreaterThanOrEqual(1)
    expect(res.body.mouvements).toBeDefined()
    expect(res.body.statut).toBe('recue')
  })

  it('ÉTAPE 5 — Stock incrémenté après réception', async () => {
    const med = await testPrisma.medicament.findUnique({
      where: { id: testMedicament.id }
    })
    // Stock initial 100 + 50 (réception) = 150
    expect(med.stockTotal).toBe(150)
  })

  it('ÉTAPE 6 — Nouveau lot de stock créé', async () => {
    const lots = await testPrisma.lotStock.findMany({
      where: { medicamentId: testMedicament.id }
    })
    expect(lots.length).toBe(2) // LOT-TEST-001 (95 restant) + LOT-NEW-001 (50)

    const newLot = lots.find(l => l.numeroLot === 'LOT-NEW-001')
    expect(newLot).toBeDefined()
    expect(newLot.quantiteInitiale).toBe(50)
    expect(newLot.quantiteRestante).toBe(50)
  })

  it('ÉTAPE 7 — MouvementStock entrée créé', async () => {
    const mouvements = await testPrisma.mouvementStock.findMany({
      where: {
        medicamentId: testMedicament.id,
        type: 'entree'
      }
    })
    expect(mouvements.length).toBeGreaterThanOrEqual(1)

    const mouvementEntree = mouvements.find(m => m.quantite === 50)
    expect(mouvementEntree).toBeDefined()
    expect(mouvementEntree.reference).toContain('Commande')
  })

  it('ÉTAPE 8 — Commande marquée comme reçue', async () => {
    const cmd = await testPrisma.commandeFournisseur.findUnique({
      where: { id: commandeId },
      include: { lignes: true }
    })
    expect(cmd.statut).toBe('recue')
    expect(cmd.lignes[0].quantiteRecue).toBe(50)
    expect(cmd.dateReception).toBeDefined()
  })
})
