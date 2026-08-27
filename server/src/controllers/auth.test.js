import { describe, it, expect, beforeEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const {
  mockStaffFindFirst,
  mockStaffUpdate,
  mockStaffFindUnique,
  mockUserFindFirst,
  mockUserFindUnique,
  mockUserUpdate,
  mockRefreshTokenCreate,
  mockRefreshTokenFindUnique,
  mockRefreshTokenDelete,
  mockRefreshTokenDeleteMany,
} = vi.hoisted(() => ({
  mockStaffFindFirst: vi.fn(),
  mockStaffUpdate: vi.fn(),
  mockStaffFindUnique: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockRefreshTokenCreate: vi.fn(),
  mockRefreshTokenFindUnique: vi.fn(),
  mockRefreshTokenDelete: vi.fn(),
  mockRefreshTokenDeleteMany: vi.fn(),
}))

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    user: {
      findFirst: mockUserFindFirst,
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
    staff: {
      findUnique: mockStaffFindUnique,
      update: mockStaffUpdate,
    },
    refreshToken: {
      create: mockRefreshTokenCreate,
      findUnique: mockRefreshTokenFindUnique,
      delete: mockRefreshTokenDelete,
      deleteMany: mockRefreshTokenDeleteMany,
    },
  },
  rawPrisma: {
    staff: {
      findFirst: mockStaffFindFirst,
      findMany: vi.fn().mockResolvedValue([]),
      update: mockStaffUpdate,
      findUnique: mockStaffFindUnique,
    },
    user: {
      findFirst: mockUserFindFirst,
    },
  },
}))

// ─── Mock config ──────────────────────────────────────────────────────────────
vi.mock('../config.js', () => ({
  config: {
    jwtSecret: 'test-secret-jwt',
    jwtRefreshSecret: 'test-secret-refresh',
    port: 3000,
    nodeEnv: 'test',
    frontendUrl: 'http://localhost:5173',
    databaseUrl: 'postgresql://test',
    brevo: { apiKey: null },
    smtp: {},
  },
}))

import { login, refresh, changePassword } from './auth.controller.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mockRes = () => {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.cookie = vi.fn().mockReturnValue(res)
  res.clearCookie = vi.fn().mockReturnValue(res)
  return res
}

const mockReq = (overrides = {}) => ({
  body: {},
  cookies: {},
  tenantId: 'tenant-1',
  tenant: { slug: 'pharma-test' },
  user: null,
  ...overrides,
})

const staffBase = {
  id: 'staff-1',
  email: 'staff@pharma.com',
  nom: 'Dupont',
  prenom: 'Jean',
  role: 'directeur',
  tenantId: 'tenant-1',
  actif: true,
  mustChangePassword: false,
  passwordHash: null, // set in beforeEach
  derniereConnexion: null,
  tenant: {
    actif: true,
    nom: 'Ecole Test',
    slug: 'pharma-test',
    config: {}
  }
}

// ─── Suite 1 : login ──────────────────────────────────────────────────────────
describe('Auth — login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si l\'email n\'existe pas', async () => {
    mockStaffFindFirst.mockResolvedValue(null)
    mockUserFindFirst.mockResolvedValue(null)

    const req = mockReq({ body: { email: 'inconnu@test.com', password: 'pass' } })
    const res = mockRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Email') })
    )
  })

  it('retourne 401 si le mot de passe est incorrect', async () => {
    const hash = await bcrypt.hash('bonMotDePasse', 10)
    mockStaffFindFirst.mockResolvedValue({ ...staffBase, passwordHash: hash })

    const req = mockReq({ body: { email: 'staff@pharma.com', password: 'mauvaisMotDePasse' } })
    const res = mockRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('mot de passe') })
    )
  })

  it('retourne 403 si le compte staff est inactif', async () => {
    const hash = await bcrypt.hash('Password1!', 10)
    mockStaffFindFirst.mockResolvedValue({
      ...staffBase,
      actif: false,
      passwordHash: hash,
    })

    const req = mockReq({ body: { email: 'staff@pharma.com', password: 'Password1!' } })
    const res = mockRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Compte désactivé' })
    )
  })

  it('retourne 403 si l\'établissement est désactivé', async () => {
    const hash = await bcrypt.hash('Password1!', 10)
    mockStaffFindFirst.mockResolvedValue({
      ...staffBase,
      passwordHash: hash,
      tenant: { ...staffBase.tenant, actif: false },
    })

    const req = mockReq({ body: { email: 'staff@pharma.com', password: 'Password1!' } })
    const res = mockRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'École désactivée' })
    )
  })

  it('pose les cookies HttpOnly sans renvoyer le JWT dans le JSON', async () => {
    const hash = await bcrypt.hash('Password1!', 10)
    mockStaffFindFirst.mockResolvedValue({ ...staffBase, passwordHash: hash })
    mockRefreshTokenCreate.mockResolvedValue({})
    mockStaffUpdate.mockResolvedValue({})

    const req = mockReq({ body: { email: 'staff@pharma.com', password: 'Password1!' } })
    const res = mockRes()

    await login(req, res)

    expect(res.status).not.toHaveBeenCalledWith(401)
    expect(res.status).not.toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ email: 'staff@pharma.com' }),
      })
    )
    const payload = res.json.mock.calls[0][0]
    expect(payload.accessToken).toBeUndefined()
    expect(res.cookie).toHaveBeenCalledWith('accessToken', expect.any(String), expect.objectContaining({
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    }))
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', expect.any(String), expect.any(Object))
  })

  it('retourne mustChangePassword: true dans le payload si le staff doit changer son MDP', async () => {
    const hash = await bcrypt.hash('Password1!', 10)
    mockStaffFindFirst.mockResolvedValue({
      ...staffBase,
      mustChangePassword: true,
      passwordHash: hash,
    })
    mockRefreshTokenCreate.mockResolvedValue({})
    mockStaffUpdate.mockResolvedValue({})

    const req = mockReq({ body: { email: 'staff@pharma.com', password: 'Password1!' } })
    const res = mockRes()

    await login(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ mustChangePassword: true })
      })
    )
  })

  it('les deux cookies sont posés avec httpOnly: true', async () => {
    const hash = await bcrypt.hash('Password1!', 10)
    mockStaffFindFirst.mockResolvedValue({ ...staffBase, passwordHash: hash })
    mockRefreshTokenCreate.mockResolvedValue({})
    mockStaffUpdate.mockResolvedValue({})

    const req = mockReq({ body: { email: 'staff@pharma.com', password: 'Password1!' } })
    const res = mockRes()

    await login(req, res)

    const cookieCalls = res.cookie.mock.calls
    expect(cookieCalls).toHaveLength(2)
    cookieCalls.forEach(([, , opts]) => {
      expect(opts).toMatchObject({ httpOnly: true })
    })
  })

  it('retourne 400 si email ou password manquant dans le body', async () => {
    const req = mockReq({ body: { email: 'staff@pharma.com' } }) // password absent
    const res = mockRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Email et mot de passe requis' })
    )
  })
})

// ─── Suite 2 : refresh token ──────────────────────────────────────────────────
describe('Auth — refresh token', () => {
  const JWT_REFRESH_SECRET = 'test-secret-refresh'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si le refresh token est absent', async () => {
    const req = mockReq({ body: {}, cookies: {} })
    const res = mockRes()

    await refresh(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('retourne 401 si le refresh token est expiré en base', async () => {
    const validToken = jwt.sign(
      { userId: 'staff-1', role: 'directeur', tenantId: 'tenant-1', type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    )
    mockRefreshTokenFindUnique.mockResolvedValue({
      token: validToken,
      expiresAt: new Date(Date.now() - 1000)
    })

    const req = mockReq({ body: { refreshToken: validToken } })
    const res = mockRes()

    await refresh(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockRefreshTokenDeleteMany).toHaveBeenCalledWith({ where: { token: validToken } })
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('expiré') })
    )
  })

  it('retourne 401 si le token JWT refresh est invalide (signature incorrecte)', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    mockRefreshTokenFindUnique.mockResolvedValue({
      token: 'bad-jwt',
      expiresAt: futureDate
    })
    mockRefreshTokenDelete.mockResolvedValue({})

    const req = mockReq({ body: { refreshToken: 'bad-jwt' } })
    const res = mockRes()

    await refresh(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('retourne un nouvel accessToken pour un refresh token valide', async () => {
    const validToken = jwt.sign(
      { userId: 'staff-1', role: 'directeur', tenantId: 'tenant-1', type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    )
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    mockRefreshTokenFindUnique.mockResolvedValue({
      token: validToken,
      expiresAt: futureDate
    })

    const req = mockReq({ body: { refreshToken: validToken } })
    const res = mockRes()

    await refresh(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    )
    expect(res.cookie).toHaveBeenCalledWith('accessToken', expect.any(String), expect.objectContaining({
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    }))
  })

  it('accepte le refresh token depuis le cookie (pas seulement le body)', async () => {
    const validToken = jwt.sign(
      { userId: 'staff-1', role: 'directeur', tenantId: 'tenant-1', type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    )
    mockRefreshTokenFindUnique.mockResolvedValue({
      token: validToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    })

    const req = mockReq({ cookies: { refreshToken: validToken }, body: {} })
    const res = mockRes()

    await refresh(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    )
  })

  it('retourne 401 si le token est absent de la base (révoqué / inconnu)', async () => {
    const validToken = jwt.sign(
      { userId: 'staff-1', role: 'directeur', tenantId: 'tenant-1', type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    )
    mockRefreshTokenFindUnique.mockResolvedValue(null) // non trouvé en base

    const req = mockReq({ body: { refreshToken: validToken } })
    const res = mockRes()

    await refresh(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockRefreshTokenDeleteMany).toHaveBeenCalledWith({ where: { userId: 'staff-1' } })
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('invalide') })
    )
  })

  it('révoque l\'ancien refresh token et en crée un nouveau (rotation)', async () => {
    const validToken = jwt.sign(
      { userId: 'staff-1', role: 'directeur', tenantId: 'tenant-1', type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    )
    mockRefreshTokenFindUnique.mockResolvedValue({
      token: validToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    })
    mockRefreshTokenDelete.mockResolvedValue({})
    mockRefreshTokenCreate.mockResolvedValue({})

    const req = mockReq({ body: { refreshToken: validToken } })
    const res = mockRes()

    await refresh(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    )
    expect(mockRefreshTokenDelete).toHaveBeenCalledWith({ where: { token: validToken } })
    expect(mockRefreshTokenCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'staff-1' }),
    }))
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', expect.any(String), expect.any(Object))
  })
})

// ─── Suite 3 : changePassword ─────────────────────────────────────────────────
describe('Auth — changePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si l\'utilisateur n\'est pas authentifié (req.user = null)', async () => {
    const req = mockReq({ user: null, body: { newPassword: 'Password1!' } })
    const res = mockRes()

    await changePassword(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Non authentifié' })
    )
  })

  it('retourne 400 pour un mot de passe faible (pas de majuscule ni chiffre)', async () => {
    const hash = await bcrypt.hash('OldPass1!', 10)
    mockStaffFindUnique.mockResolvedValue({ id: 'staff-1', passwordHash: hash, mustChangePassword: false })

    const req = mockReq({
      user: { id: 'staff-1', role: 'directeur', mustChangePassword: false },
      body: { currentPassword: 'OldPass1!', newPassword: 'faible' }
    })
    const res = mockRes()

    await changePassword(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )
  })

  it('retourne 400 pour un mot de passe sans caractère spécial', async () => {
    const hash = await bcrypt.hash('OldPass1!', 10)
    mockStaffFindUnique.mockResolvedValue({ id: 'staff-1', passwordHash: hash, mustChangePassword: false })

    const req = mockReq({
      user: { id: 'staff-1', role: 'directeur', mustChangePassword: false },
      body: { currentPassword: 'OldPass1!', newPassword: 'Password123' }
    })
    const res = mockRes()

    await changePassword(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('retourne 401 si le mot de passe actuel est incorrect', async () => {
    const hash = await bcrypt.hash('BonMotDePasse1!', 10)
    mockStaffFindUnique.mockResolvedValue({ id: 'staff-1', passwordHash: hash, mustChangePassword: false })

    const req = mockReq({
      user: { id: 'staff-1', role: 'directeur', mustChangePassword: false },
      body: { currentPassword: 'MauvaisMotDePasse', newPassword: 'NewPass1!' }
    })
    const res = mockRes()

    await changePassword(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('retourne 200 et mustChangePassword=false après changement réussi', async () => {
    const hash = await bcrypt.hash('OldPass1!', 10)
    mockStaffFindUnique.mockResolvedValue({ id: 'staff-1', passwordHash: hash, mustChangePassword: true })
    mockStaffUpdate.mockResolvedValue({ id: 'staff-1', mustChangePassword: false })

    const req = mockReq({
      user: { id: 'staff-1', role: 'directeur', mustChangePassword: true },
      body: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }
    })
    const res = mockRes()

    await changePassword(req, res)

    expect(mockStaffUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mustChangePassword: false })
      })
    )
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('succès') })
    )
  })

  it('saute la vérification du mot de passe actuel si mustChangePassword=true', async () => {
    const hash = await bcrypt.hash('TempPass1!', 10)
    mockStaffFindUnique.mockResolvedValue({ id: 'staff-1', passwordHash: hash, mustChangePassword: true })
    mockStaffUpdate.mockResolvedValue({ id: 'staff-1', mustChangePassword: false })

    const req = mockReq({
      user: { id: 'staff-1', role: 'directeur', mustChangePassword: true },
      body: {
        // currentPassword volontairement incorrect — doit être ignoré
        currentPassword: 'mauvaisAncienMDP',
        newPassword: 'NewSecure1!'
      }
    })
    const res = mockRes()

    await changePassword(req, res)

    // Ne doit PAS retourner 401 malgré le mauvais currentPassword
    expect(res.status).not.toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('succès') })
    )
  })

  it('retourne 400 pour un mot de passe sans majuscule (ex: "password1!")', async () => {
    const hash = await bcrypt.hash('OldPass1!', 10)
    mockStaffFindUnique.mockResolvedValue({ id: 'staff-1', passwordHash: hash, mustChangePassword: false })

    const req = mockReq({
      user: { id: 'staff-1', role: 'directeur', mustChangePassword: false },
      body: { currentPassword: 'OldPass1!', newPassword: 'password1!' } // pas de majuscule
    })
    const res = mockRes()

    await changePassword(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )
  })

  it('retourne 400 pour un mot de passe sans chiffre (ex: "Password!")', async () => {
    const hash = await bcrypt.hash('OldPass1!', 10)
    mockStaffFindUnique.mockResolvedValue({ id: 'staff-1', passwordHash: hash, mustChangePassword: false })

    const req = mockReq({
      user: { id: 'staff-1', role: 'directeur', mustChangePassword: false },
      body: { currentPassword: 'OldPass1!', newPassword: 'Password!' } // pas de chiffre
    })
    const res = mockRes()

    await changePassword(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('retourne 400 pour un mot de passe de moins de 8 caractères', async () => {
    const hash = await bcrypt.hash('OldPass1!', 10)
    mockStaffFindUnique.mockResolvedValue({ id: 'staff-1', passwordHash: hash, mustChangePassword: false })

    const req = mockReq({
      user: { id: 'staff-1', role: 'directeur', mustChangePassword: false },
      body: { currentPassword: 'OldPass1!', newPassword: 'Aa1!' } // 4 chars seulement
    })
    const res = mockRes()

    await changePassword(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('change le mot de passe d\'un parent sans mettre à jour mustChangePassword', async () => {
    const hash = await bcrypt.hash('OldPass1!', 10)
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', passwordHash: hash, mustChangePassword: false })
    mockUserUpdate.mockResolvedValue({ id: 'user-1' })

    const req = mockReq({
      user: { id: 'user-1', role: 'parent', mustChangePassword: false },
      body: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }
    })
    const res = mockRes()

    await changePassword(req, res)

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ passwordHash: expect.any(String) })
      })
    )
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('succès') })
    )
  })
})
