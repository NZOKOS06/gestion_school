import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { ordonnanceValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/ordonnances.controller.js';
import { uploadOrdonnance, requireCloudinary } from '../utils/cloudinary.js';

const router = Router();

/**
 * @swagger
 * /api/ordonnances:
 *   post:
 *     summary: Créer une nouvelle ordonnance
 *     tags: [Ordonnances]
 *     parameters:
 *       - $ref: '#/components/parameters/TenantSlug'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [lignes]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               lignes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     medicamentId:
 *                       type: string
 *                       format: uuid
 *                     quantite:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Ordonnance créée
 *       400:
 *         description: Données invalides
 */
// POST /api/ordonnances (client ou staff)
router.post('/',
  authenticate,
  requireRole('client', 'vendeur', 'preparateur', 'pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('ordonnances'),
  requireCloudinary,
  uploadOrdonnance.single('image'),
  ctrl.create
);

/**
 * @swagger
 * /api/ordonnances/{id}/valider:
 *   put:
 *     summary: Valider une ordonnance
 *     tags: [Ordonnances]
 *     parameters:
 *       - $ref: '#/components/parameters/TenantSlug'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lignesDelivrees]
 *             properties:
 *               lignesDelivrees:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     medicamentId:
 *                       type: string
 *                       format: uuid
 *                     quantite:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Ordonnance validée
 */
// PUT /api/ordonnances/:id/valider
router.put('/:id/valider',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('ordonnances'),
  idParamValidator,
  ctrl.valider
);

// GET /api/ordonnances
router.get('/',
  authenticate,
  requireRole('pharmacien', 'admin', 'vendeur', 'preparateur'),
  requireTenantMatch,
  requireModule('ordonnances'),
  paginationValidator,
  ctrl.getAll
);

// GET /api/ordonnances/mes-ordonnances (pour client) — AVANT /:id pour éviter conflit
router.get('/mes-ordonnances',
  authenticate,
  requireRole('client'),
  requireTenantMatch,
  requireModule('ordonnances'),
  ctrl.getMesOrdonnances
);

// GET /api/ordonnances/:id
router.get('/:id',
  authenticate,
  requireRole('pharmacien', 'admin', 'vendeur', 'preparateur', 'client'),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

// PUT /api/ordonnances/:id/refuser
router.put('/:id/refuser',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('ordonnances'),
  idParamValidator,
  ctrl.refuser
);

// PUT /api/ordonnances/:id/dispenser
router.put('/:id/dispenser',
  authenticate,
  requireRole('pharmacien', 'admin', 'vendeur'),
  requireTenantMatch,
  requireModule('ordonnances'),
  idParamValidator,
  ctrl.dispenser
);

export default router;
