import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../index.js'
import { setupTestDB, teardownTestDB, TEST_TENANT_SLUG, testVendeur, testPharmacien, testMedicament, testPrisma } from './setup.js'

let vendeurToken, pharmacienToken, ordonnanceId

beforeAll(async () => {
  await setupTestDB()
})
afterAll(async () => {
  await teardownTestDB()
})

describe('FLUX ORDONNANCE — Vendeur → Pharmacien', () => {

  it('ÉTAPE 1 — Vendeur se connecte', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({ email: testVendeur.email, password: 'Test123!@#' })

    expect(res.status).toBe(200)
    vendeurToken = res.headers['set-cookie'].find(c => c.startsWith('accessToken'))
  })

  it('ÉTAPE 2 — Pharmacien se connecte', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({ email: testPharmacien.email, password: 'Test123!@#' })

    expect(res.status).toBe(200)
    pharmacienToken = res.headers['set-cookie'].find(c => c.startsWith('accessToken'))
  })

  it('ÉTAPE 3 — Vendeur soumet une ordonnance', async () => {
    const res = await request(app)
      .post('/api/ordonnances')
      .set('Cookie', vendeurToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({
        nomMedecin: 'Dr. Test',
        numeroMedecin: '12345',
        dateOrdonnance: new Date().toISOString().split('T')[0],
        lignes: [
          {
            medicamentId: testMedicament.id,
            posologie: '1 comprimé 3 fois par jour',
            duree: '7 jours',
            quantitePrescrite: 21
          }
        ]
      })

    expect(res.status).toBe(201)
    expect(res.body).toBeDefined()
    expect(res.body.statut).toBe('en_attente')
    ordonnanceId = res.body.id
  })

  it('ÉTAPE 4 — Pharmacien voit l\'ordonnance en attente', async () => {
    const res = await request(app)
      .get('/api/ordonnances?statut=en_attente')
      .set('Cookie', pharmacienToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    const ordonnance = res.body.data.find(o => o.id === ordonnanceId)
    expect(ordonnance).toBeDefined()
    expect(ordonnance.statut).toBe('en_attente')
  })

  it('ÉTAPE 5 — Pharmacien valide l\'ordonnance', async () => {
    const res = await request(app)
      .put(`/api/ordonnances/${ordonnanceId}/valider`)
      .set('Cookie', pharmacienToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({
        lignesDelivrees: [
          {
            id: (await testPrisma.ligneOrdonnance.findFirst({ where: { ordonnanceId } })).id,
            quantiteDelivree: 21
          }
        ]
      })

    expect(res.status).toBe(200)
    expect(res.body.statut).toBe('validee')

    // Vérifier en DB
    const ord = await testPrisma.ordonnance.findUnique({ where: { id: ordonnanceId } })
    expect(ord.statut).toBe('validee')
  })

  it('ÉTAPE 6 — Vendeur ne peut pas refuser une ordonnance', async () => {
    // Créer une nouvelle ordonnance pour le test
    const createRes = await request(app)
      .post('/api/ordonnances')
      .set('Cookie', vendeurToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({
        nomMedecin: 'Dr. Refus',
        numeroMedecin: '99999',
        lignes: [{ medicamentId: testMedicament.id, posologie: 'test', duree: '1j', quantitePrescrite: 1 }]
      })

    const newOrdoId = createRes.body.id

    const res = await request(app)
      .put(`/api/ordonnances/${newOrdoId}/refuser`)
      .set('Cookie', vendeurToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({ motif: 'test refus' })

    // Le vendeur n'a pas les droits pour refuser (seul pharmacien/admin)
    expect(res.status).toBe(403)
  })

  it('ÉTAPE 7 — Pharmacien dispense l\'ordonnance', async () => {
    const res = await request(app)
      .put(`/api/ordonnances/${ordonnanceId}/dispenser`)
      .set('Cookie', pharmacienToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)

    expect(res.status).toBe(200)
    expect(res.body.statut).toBe('dispensee')

    // Vérifier en DB
    const ord = await testPrisma.ordonnance.findUnique({ where: { id: ordonnanceId } })
    expect(ord.statut).toBe('dispensee')
  })

  it('ÉTAPE 8 — Impossible de dispenser si pas validée', async () => {
    // Créer une nouvelle ordonnance pour le test
    const createRes = await request(app)
      .post('/api/ordonnances')
      .set('Cookie', vendeurToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)
      .send({
        nomMedecin: 'Dr. Non Valide',
        numeroMedecin: '88888',
        lignes: [{ medicamentId: testMedicament.id, posologie: 'test', duree: '1j', quantitePrescrite: 1 }]
      })

    const nonValideId = createRes.body.id

    const res = await request(app)
      .put(`/api/ordonnances/${nonValideId}/dispenser`)
      .set('Cookie', pharmacienToken)
      .set('X-Tenant-Slug', TEST_TENANT_SLUG)

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('validée')
  })
})
