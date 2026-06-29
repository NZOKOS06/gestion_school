import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Hoisted mocks (accessible inside vi.mock factories) ──────────────────────
const {
  mockLotFindMany,
  mockLotUpdate,
  mockLotCreate,
  mockMouvementCreate,
  mockMedicamentUpdate,
  mockMedicamentFindFirst,
  mockTransaction,
} = vi.hoisted(() => ({
  mockLotFindMany: vi.fn(),
  mockLotUpdate: vi.fn(),
  mockLotCreate: vi.fn(),
  mockMouvementCreate: vi.fn(),
  mockMedicamentUpdate: vi.fn(),
  mockMedicamentFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
}))

// Mock pharmacyEvents so emitStockAlerte doesn't crash
vi.mock('./pharmacyEvents.js', () => ({
  emitStockAlerte: vi.fn(),
}))

vi.mock('./prisma.js', () => ({
  prisma: {
    lotStock: { findMany: mockLotFindMany, update: mockLotUpdate, create: mockLotCreate },
    mouvementStock: { create: mockMouvementCreate },
    medicament: { update: mockMedicamentUpdate, findFirst: mockMedicamentFindFirst },
    $transaction: mockTransaction,
  },
  rawPrisma: {
    lotStock: { findMany: mockLotFindMany, update: mockLotUpdate, create: mockLotCreate },
    mouvementStock: { create: mockMouvementCreate },
    medicament: { update: mockMedicamentUpdate, findFirst: mockMedicamentFindFirst },
  }
}))

import { decrementerStockFEFO, retourStock, ajustementStock, receptionCommande } from './stockFEFO.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TENANT = 'tenant-1'
const MED_ID = 'med-1'
const STAFF_ID = 'staff-1'
const VENTE_ID = 'vente-1'

const futur = (daysFromNow) => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d
}

const mockMedicamentResult = (stockTotal) => ({
  id: MED_ID,
  stockTotal,
  seuilAlerte: 5,
  tenant: { slug: 'pharma-test' }
})

// ─── Suite 1 : decrementerStockFEFO – cas d'erreur ───────────────────────────
describe('FEFO — decrementerStockFEFO : cas d\'erreur', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lève une erreur si aucun lot ET stockTotal insuffisant', async () => {
    mockLotFindMany.mockResolvedValue([])
    // stockTotal = 2 < quantite = 5 → erreur
    mockMedicamentFindFirst.mockResolvedValue({ id: MED_ID, stockTotal: 2, prixAchat: 100 })

    await expect(
      decrementerStockFEFO(TENANT, MED_ID, 5, VENTE_ID, STAFF_ID)
    ).rejects.toThrow('Stock insuffisant : aucun lot disponible')
  })

  it('crée un lot générique si stockTotal suffisant mais aucun lot existant', async () => {
    mockLotFindMany.mockResolvedValue([])
    mockMedicamentFindFirst.mockResolvedValue({ id: MED_ID, stockTotal: 100, prixAchat: 500 })
    mockLotCreate.mockResolvedValue({
      id: 'lot-generic', quantiteRestante: 100,
      datePeremption: futur(365), numeroLot: 'INIT-000'
    })
    mockLotUpdate.mockResolvedValue({})
    mockMouvementCreate.mockResolvedValue({ id: 'mvt-1' })
    mockMedicamentUpdate.mockResolvedValue(mockMedicamentResult(95))

    const result = await decrementerStockFEFO(TENANT, MED_ID, 5, VENTE_ID, STAFF_ID)

    expect(mockLotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ numeroLot: expect.stringContaining('INIT'), quantiteRestante: 100 })
      })
    )
    expect(result.lignesLot).toHaveLength(1)
    expect(result.lignesLot[0].quantite).toBe(5)
  })

  it('lève une erreur si le stock total des lots est insuffisant', async () => {
    mockLotFindMany.mockResolvedValue([
      { id: 'lot-1', quantiteRestante: 2, datePeremption: futur(30) }
    ])

    await expect(
      decrementerStockFEFO(TENANT, MED_ID, 10, VENTE_ID, STAFF_ID)
    ).rejects.toThrow('Stock insuffisant')
  })
})

// ─── Suite 2 : decrementerStockFEFO – décrémentation FEFO ────────────────────
describe('FEFO — decrementerStockFEFO : décrémentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLotUpdate.mockResolvedValue({})
    mockMouvementCreate.mockResolvedValue({ id: 'mouvement-1' })
  })

  it('décrémente le lot le plus proche de péremption en premier (1 lot suffit)', async () => {
    const lotProche = { id: 'lot-proche', quantiteRestante: 10, datePeremption: futur(5) }
    const lotLoin = { id: 'lot-loin', quantiteRestante: 10, datePeremption: futur(60) }

    mockLotFindMany.mockResolvedValue([lotProche, lotLoin])
    mockMedicamentUpdate.mockResolvedValue(mockMedicamentResult(15))

    const result = await decrementerStockFEFO(TENANT, MED_ID, 3, VENTE_ID, STAFF_ID)

    // Le premier update doit toucher le lot le plus proche
    expect(mockLotUpdate).toHaveBeenCalledTimes(1)
    expect(mockLotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lot-proche' } })
    )
    expect(result.lignesLot).toHaveLength(1)
    expect(result.lignesLot[0].lotStockId).toBe('lot-proche')
    expect(result.lignesLot[0].quantite).toBe(3)
  })

  it('répartit sur plusieurs lots si le premier est insuffisant', async () => {
    const lot1 = { id: 'lot-1', quantiteRestante: 3, datePeremption: futur(5) }
    const lot2 = { id: 'lot-2', quantiteRestante: 10, datePeremption: futur(30) }

    mockLotFindMany.mockResolvedValue([lot1, lot2])
    mockMedicamentUpdate.mockResolvedValue(mockMedicamentResult(8))

    const result = await decrementerStockFEFO(TENANT, MED_ID, 7, VENTE_ID, STAFF_ID)

    expect(mockLotUpdate).toHaveBeenCalledTimes(2)
    expect(result.lignesLot).toHaveLength(2)

    const ligneL1 = result.lignesLot.find(l => l.lotStockId === 'lot-1')
    const ligneL2 = result.lignesLot.find(l => l.lotStockId === 'lot-2')

    expect(ligneL1.quantite).toBe(3)
    expect(ligneL2.quantite).toBe(4)
  })

  it('retourne le stock restant après décrémentation', async () => {
    mockLotFindMany.mockResolvedValue([
      { id: 'lot-1', quantiteRestante: 20, datePeremption: futur(10) }
    ])
    mockMedicamentUpdate.mockResolvedValue(mockMedicamentResult(15))

    const result = await decrementerStockFEFO(TENANT, MED_ID, 5, VENTE_ID, STAFF_ID)

    expect(result.stockRestant).toBe(15)
  })
})

// ─── Suite 3 : retourStock ────────────────────────────────────────────────────
describe('FEFO — retourStock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLotUpdate.mockResolvedValue({})
    mockMedicamentUpdate.mockResolvedValue(mockMedicamentResult(10))
    mockMouvementCreate.mockResolvedValue({ id: 'mouvement-retour', type: 'retour' })
  })

  it('incrémente le lot concerné lors d\'un retour', async () => {
    await retourStock(TENANT, MED_ID, 'lot-1', 5, 'Annulation vente 42', STAFF_ID)

    expect(mockLotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lot-1' },
        data: { quantiteRestante: { increment: 5 } }
      })
    )
  })

  it('crée un mouvement de type retour', async () => {
    const mouvement = await retourStock(TENANT, MED_ID, 'lot-1', 5, 'Annulation vente 42', STAFF_ID)

    expect(mockMouvementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'retour', quantite: 5 })
      })
    )
    expect(mouvement.type).toBe('retour')
  })

  it('incrémente le stock total du médicament', async () => {
    await retourStock(TENANT, MED_ID, 'lot-1', 5, 'Annulation vente 42', STAFF_ID)

    expect(mockMedicamentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MED_ID },
        data: { stockTotal: { increment: 5 } }
      })
    )
  })
})

// ─── Suite 4b : decrementerStockFEFO – quantités résiduelles exactes ─────────
describe('FEFO — decrementerStockFEFO : quantités résiduelles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMouvementCreate.mockResolvedValue({ id: 'mouvement-1' })
    mockMedicamentUpdate.mockResolvedValue({
      id: MED_ID, stockTotal: 80, seuilAlerte: 5, tenant: { slug: 'pharma-test' }
    })
  })

  it('decrement utilise { decrement: quantiteAPrendre } sur le lot', async () => {
    mockLotUpdate.mockResolvedValue({})
    mockLotFindMany.mockResolvedValue([
      { id: 'lot-A', quantiteRestante: 50, datePeremption: futur(30) }
    ])

    await decrementerStockFEFO(TENANT, MED_ID, 20, VENTE_ID, STAFF_ID)

    expect(mockLotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lot-A' },
        data: { quantiteRestante: { decrement: 20 } }
      })
    )
  })

  it('épuise lot-A (10) puis prend 25 sur lot-B (50 → 25)', async () => {
    mockLotUpdate.mockResolvedValue({})
    mockLotFindMany.mockResolvedValue([
      { id: 'lot-A', quantiteRestante: 10, datePeremption: futur(30) },
      { id: 'lot-B', quantiteRestante: 50, datePeremption: futur(90) },
    ])

    const result = await decrementerStockFEFO(TENANT, MED_ID, 35, VENTE_ID, STAFF_ID)

    // lot-A : decrement 10 (épuisé)
    expect(mockLotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lot-A' }, data: { quantiteRestante: { decrement: 10 } } })
    )
    // lot-B : decrement 25 (reste 25)
    expect(mockLotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lot-B' }, data: { quantiteRestante: { decrement: 25 } } })
    )
    expect(result.lignesLot).toHaveLength(2)
    const ligneB = result.lignesLot.find(l => l.lotStockId === 'lot-B')
    expect(ligneB.quantite).toBe(25)
  })

  it('crée un mouvementStock par lot consommé avec type "sortie"', async () => {
    mockLotUpdate.mockResolvedValue({})
    mockLotFindMany.mockResolvedValue([
      { id: 'lot-A', quantiteRestante: 5, datePeremption: futur(10) },
      { id: 'lot-B', quantiteRestante: 10, datePeremption: futur(20) },
    ])

    await decrementerStockFEFO(TENANT, MED_ID, 8, VENTE_ID, STAFF_ID)

    expect(mockMouvementCreate).toHaveBeenCalledTimes(2)
    expect(mockMouvementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'sortie', lotStockId: 'lot-A', quantite: 5 })
      })
    )
    expect(mockMouvementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'sortie', lotStockId: 'lot-B', quantite: 3 })
      })
    )
  })

  it('lève une erreur si stock total insuffisant (5 disponible, 10 demandé)', async () => {
    mockLotFindMany.mockResolvedValue([
      { id: 'lot-1', quantiteRestante: 5, datePeremption: futur(30) }
    ])

    await expect(
      decrementerStockFEFO(TENANT, MED_ID, 10, VENTE_ID, STAFF_ID)
    ).rejects.toThrow(/insuffisant/i)
  })

  it('met à jour stockTotal du médicament avec decrement = quantite totale vendue', async () => {
    mockLotUpdate.mockResolvedValue({})
    mockLotFindMany.mockResolvedValue([
      { id: 'lot-1', quantiteRestante: 40, datePeremption: futur(15) }
    ])

    await decrementerStockFEFO(TENANT, MED_ID, 12, VENTE_ID, STAFF_ID)

    expect(mockMedicamentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MED_ID },
        data: { stockTotal: { decrement: 12 } }
      })
    )
  })
})

// ─── Suite 4 : logique FEFO – ordonnancement ─────────────────────────────────
describe('FEFO — ordonnancement des lots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLotUpdate.mockResolvedValue({})
    mockMouvementCreate.mockResolvedValue({ id: 'mouvement-1' })
    mockMedicamentUpdate.mockResolvedValue(mockMedicamentResult(10))
  })

  it('consomme d\'abord le lot dont la péremption est la plus proche (ordre ASC attendu du mock)', async () => {
    // Le mock retourne les lots déjà triés ASC (comme Prisma le ferait)
    const lotsTriesAsc = [
      { id: 'lot-j5', quantiteRestante: 5, datePeremption: futur(5) },
      { id: 'lot-j10', quantiteRestante: 5, datePeremption: futur(10) },
      { id: 'lot-j30', quantiteRestante: 5, datePeremption: futur(30) },
    ]
    mockLotFindMany.mockResolvedValue(lotsTriesAsc)

    const result = await decrementerStockFEFO(TENANT, MED_ID, 5, VENTE_ID, STAFF_ID)

    // Seul le premier lot (péremption J+5) doit être touché
    expect(result.lignesLot).toHaveLength(1)
    expect(result.lignesLot[0].lotStockId).toBe('lot-j5')
  })

  it('la requête findMany est appelée avec orderBy datePeremption asc', async () => {
    mockLotFindMany.mockResolvedValue([
      { id: 'lot-1', quantiteRestante: 10, datePeremption: futur(10) }
    ])
    mockMedicamentUpdate.mockResolvedValue(mockMedicamentResult(5))

    await decrementerStockFEFO(TENANT, MED_ID, 2, VENTE_ID, STAFF_ID)

    expect(mockLotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { datePeremption: 'asc' }
      })
    )
  })

  it('filtre uniquement les lots non périmés (datePeremption > now)', async () => {
    mockLotFindMany.mockResolvedValue([
      { id: 'lot-1', quantiteRestante: 10, datePeremption: futur(10) }
    ])
    mockMedicamentUpdate.mockResolvedValue(mockMedicamentResult(5))

    await decrementerStockFEFO(TENANT, MED_ID, 2, VENTE_ID, STAFF_ID)

    const callArgs = mockLotFindMany.mock.calls[0][0]
    expect(callArgs.where.datePeremption).toHaveProperty('gt')
    expect(callArgs.where.quantiteRestante).toEqual({ gt: 0 })
  })
})

// ─── Suite 5 : ajustementStock ────────────────────────────────────────────────
describe('ajustementStock', () => {
  const LOT_ID = 'lot-ajust-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exécute les 3 écritures (lotUpdate + mouvementCreate + medicamentUpdate) dans une transaction', async () => {
    const txLotUpdate = vi.fn().mockResolvedValue({ id: LOT_ID, quantiteRestante: 30 })
    const txMouvementCreate = vi.fn().mockResolvedValue({ id: 'mvt-ajust', type: 'ajustement' })
    const txMedicamentUpdate = vi.fn().mockResolvedValue({ id: MED_ID, stockTotal: 30 })

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        lotStock: { update: txLotUpdate },
        mouvementStock: { create: txMouvementCreate },
        medicament: { update: txMedicamentUpdate },
      }
      return fn(tx)
    })

    const result = await ajustementStock(TENANT, MED_ID, LOT_ID, 30, 5, STAFF_ID, 'Inventaire physique')

    expect(txLotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LOT_ID }, data: { quantiteRestante: 30 } })
    )
    expect(txMouvementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ajustement', quantite: 5, lotStockId: LOT_ID })
      })
    )
    expect(txMedicamentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: MED_ID } })
    )
    expect(result).toHaveProperty('lot')
    expect(result).toHaveProperty('mouvement')
    expect(result).toHaveProperty('updated')
  })

  it('incrémente stockTotal si différence > 0', async () => {
    let capturedData = null
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        lotStock: { update: vi.fn().mockResolvedValue({}) },
        mouvementStock: { create: vi.fn().mockResolvedValue({ id: 'mvt-1', type: 'ajustement' }) },
        medicament: {
          update: vi.fn().mockImplementation(({ data }) => {
            capturedData = data
            return Promise.resolve({ id: MED_ID, stockTotal: 110 })
          }),
        },
      }
      return fn(tx)
    })

    await ajustementStock(TENANT, MED_ID, LOT_ID, 110, 10, STAFF_ID)

    expect(capturedData.stockTotal).toEqual({ increment: 10 })
  })

  it('décrémente stockTotal si différence < 0', async () => {
    let capturedData = null
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        lotStock: { update: vi.fn().mockResolvedValue({}) },
        mouvementStock: { create: vi.fn().mockResolvedValue({ id: 'mvt-1', type: 'ajustement' }) },
        medicament: {
          update: vi.fn().mockImplementation(({ data }) => {
            capturedData = data
            return Promise.resolve({ id: MED_ID, stockTotal: 90 })
          }),
        },
      }
      return fn(tx)
    })

    await ajustementStock(TENANT, MED_ID, LOT_ID, 90, -10, STAFF_ID)

    expect(capturedData.stockTotal).toEqual({ decrement: 10 })
  })

  it('rollback : propage l\'erreur si une écriture tx échoue', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        lotStock: { update: vi.fn().mockRejectedValue(new Error('DB constraint violation')) },
        mouvementStock: { create: vi.fn() },
        medicament: { update: vi.fn() },
      }
      return fn(tx)
    })

    await expect(
      ajustementStock(TENANT, MED_ID, LOT_ID, 30, 5, STAFF_ID)
    ).rejects.toThrow('DB constraint violation')
  })
})

// ─── Suite 6 : receptionCommande ─────────────────────────────────────────────
describe('receptionCommande', () => {
  const COMMANDE_ID = 'cmd-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crée un lot et un mouvement d\'entrée pour chaque ligne', async () => {
    const txLotCreate = vi.fn().mockResolvedValue({ id: 'lot-new', quantiteRestante: 50 })
    const txMouvementCreate = vi.fn().mockResolvedValue({ id: 'mvt-entree', type: 'entree' })
    const txMedicamentUpdate = vi.fn().mockResolvedValue({ id: MED_ID, stockTotal: 150 })

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        lotStock: { create: txLotCreate },
        mouvementStock: { create: txMouvementCreate },
        medicament: { update: txMedicamentUpdate },
      }
      return fn(tx)
    })

    const lignes = [
      {
        medicamentId: MED_ID,
        numeroLot: 'LOT-2026-001',
        datePeremption: futur(365),
        quantiteRecue: 50,
        prixAchatLot: 800,
        fournisseurId: 'fourn-1',
      }
    ]

    const result = await receptionCommande(TENANT, COMMANDE_ID, lignes, STAFF_ID)

    expect(txLotCreate).toHaveBeenCalledTimes(1)
    expect(txLotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          numeroLot: 'LOT-2026-001',
          quantiteInitiale: 50,
          quantiteRestante: 50,
        })
      })
    )
    expect(txMouvementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'entree', quantite: 50 })
      })
    )
    expect(txMedicamentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stockTotal: { increment: 50 } })
      })
    )
    expect(result.lotsCrees).toHaveLength(1)
    expect(result.mouvements).toHaveLength(1)
  })

  it('traite N lignes et retourne N lots + N mouvements', async () => {
    let callCount = 0
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        lotStock: { create: vi.fn().mockImplementation(() => Promise.resolve({ id: `lot-${++callCount}` })) },
        mouvementStock: { create: vi.fn().mockResolvedValue({ id: `mvt-${callCount}`, type: 'entree' }) },
        medicament: { update: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx)
    })

    const lignes = [
      { medicamentId: 'med-1', numeroLot: 'L1', datePeremption: futur(200), quantiteRecue: 20, prixAchatLot: 500 },
      { medicamentId: 'med-2', numeroLot: 'L2', datePeremption: futur(300), quantiteRecue: 30, prixAchatLot: 700 },
    ]

    const result = await receptionCommande(TENANT, COMMANDE_ID, lignes, STAFF_ID)

    expect(result.lotsCrees).toHaveLength(2)
    expect(result.mouvements).toHaveLength(2)
  })
})
