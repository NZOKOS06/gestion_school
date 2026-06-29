import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../index.js'
import { setupTestDB, teardownTestDB, TEST_TENANT_SLUG, testVendeur, testCaissier, testMedicament, testLot, testPrisma } from './setup.js'

let vendeurToken, caissierToken, venteId

beforeAll(async () => {
  await setupTestDB()
})
afterAll(async () => {
  await teardownTestDB()
})

describe('FLUX VENTE COMPLET — Vendeur → Caissier', () => {

  it('ÉTAPE 1 — Vendeur se connecte', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({ email: testVendeur.email, password: 'Test123!@#' })

    expect(res.status).toBe(200)
    expect(res.body.user).toBeDefined()
    expect(res.body.user.role).toBe('vendeur')
    expect(res.headers['set-cookie']).toBeDefined()
    // Extraire le cookie accessToken
    vendeurToken = res.headers['set-cookie']
      .find(c => c.startsWith('accessToken'))
  })

  it('ÉTAPE 2 — Vendeur recherche le médicament', async () => {
    const res = await request(app)
      .get('/api/medicaments?search=paracétamol')
      .set('Cookie', vendeurToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data[0].dci).toBe('Paracétamol')
    expect(res.body.data[0].stockTotal).toBe(100)
  })

  it('ÉTAPE 3 — Vendeur crée une vente', async () => {
    const res = await request(app)
      .post('/api/ventes')
      .set('Cookie', vendeurToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({
        nomClient: 'Patient Test',
        telephoneClient: '06 12 34 56 78',
        lignes: [{ medicamentId: testMedicament.id, quantite: 5 }]
      })

    expect(res.status).toBe(201)
    expect(res.body.vente).toBeDefined()
    expect(res.body.vente.statut).toBe('en_cours')
    expect(parseFloat(res.body.vente.montantTotal)).toBe(4000) // 5 × 800 FCFA
    venteId = res.body.vente.id
  })

  it('ÉTAPE 4 — Stock décrémenté après la vente (FEFO)', async () => {
    const med = await testPrisma.medicament.findUnique({
      where: { id: testMedicament.id }
    })
    expect(med.stockTotal).toBe(95) // 100 - 5

    const lot = await testPrisma.lotStock.findUnique({
      where: { id: testLot.id }
    })
    expect(lot.quantiteRestante).toBe(95)
  })

  it('ÉTAPE 5 — MouvementStock créé', async () => {
    const mouvements = await testPrisma.mouvementStock.findMany({
      where: { medicamentId: testMedicament.id, type: 'sortie' }
    })
    expect(mouvements.length).toBe(1)
    expect(mouvements[0].quantite).toBe(5)
  })

  it('ÉTAPE 6 — Caissier se connecte', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({ email: testCaissier.email, password: 'Test123!@#' })

    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('caissier')
    caissierToken = res.headers['set-cookie']
      .find(c => c.startsWith('accessToken'))
  })

  it('ÉTAPE 7 — Caissier voit la vente en attente', async () => {
    const res = await request(app)
      .get('/api/ventes?statut=en_cours')
      .set('Cookie', caissierToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)

    expect(res.status).toBe(200)
    const vente = res.body.data.find(v => v.id === venteId)
    expect(vente).toBeDefined()
    expect(vente.statut).toBe('en_cours')
  })

  it('ÉTAPE 8 — Caissier encaisse la vente (espèces)', async () => {
    const res = await request(app)
      .post(`/api/ventes/${venteId}/encaisser`)
      .set('Cookie', caissierToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({
        modePaiement: 'especes',
        montantRecu: 5000,
        reference: 'Encaissement caisse'
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.vente.statut).toBe('finalisee')
    expect(res.body.vente.modePaiement).toBe('especes')
    expect(parseFloat(res.body.vente.montantRecu)).toBe(5000)
    expect(parseFloat(res.body.vente.monnaie)).toBe(1000) // 5000 - 4000
  })

  it('ÉTAPE 9 — Vente finalisée visible dans les rapports', async () => {
    const pharmacienRes = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({ email: 'pharmacien@test.cg', password: 'Test123!@#' })
    const pharmacienToken = pharmacienRes.headers['set-cookie']
      .find(c => c.startsWith('accessToken'))

    const res = await request(app)
      .get('/api/dashboard/kpis')
      .set('Cookie', pharmacienToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)

    expect(res.status).toBe(200)
    expect(res.body.ventes).toBeDefined()
    expect(res.body.ventes.today.count).toBeGreaterThanOrEqual(1)
    expect(parseFloat(res.body.ventes.today.montant)).toBeGreaterThanOrEqual(4000)
  })

  it('ÉTAPE 10 — Annulation impossible sur vente finalisée', async () => {
    const res = await request(app)
      .put(`/api/ventes/${venteId}/annuler`)
      .set('Cookie', caissierToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({ motif: 'test annulation' })

    // Soit 403 (rôle caissier pas autorisé) soit 400 (déjà finalisée)
    expect([400, 403]).toContain(res.status)
  })
})
