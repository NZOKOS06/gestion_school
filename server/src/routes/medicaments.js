import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { medicamentValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/medicaments.controller.js';

const router = Router();

/**
 * @swagger
 * /api/medicaments:
 *   get:
 *     summary: Lister les médicaments
 *     tags: [Médicaments]
 *     parameters:
 *       - $ref: '#/components/parameters/TenantSlug'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Recherche par DCI ou nom commercial
 *       - in: query
 *         name: categorie
 *         schema: { type: string }
 *         description: Filtrer par catégorie
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste des médicaments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Medicament'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 */
// GET /api/medicaments - Catalogue interne (staff)
router.get('/',
  authenticate,
  requireRole('pharmacien', 'admin', 'vendeur', 'preparateur', 'caissier'),
  requireTenantMatch,
  requireModule('catalogue'),
  paginationValidator,
  ctrl.getAll
);

// GET /api/medicaments/stock-alerts - Alertes stock
router.get('/stock-alerts',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('stock'),
  ctrl.getStockAlerts
);

// GET /api/medicaments/:id
router.get('/:id',
  authenticate,
  requireRole('pharmacien', 'admin', 'vendeur', 'preparateur', 'caissier'),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

// POST /api/medicaments
router.post('/',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('catalogue'),
  medicamentValidator,
  ctrl.create
);

// PUT /api/medicaments/:id
router.put('/:id',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('catalogue'),
  idParamValidator,
  ctrl.update
);

// DELETE /api/medicaments/:id (désactivation)
router.delete('/:id',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('catalogue'),
  idParamValidator,
  ctrl.remove
);

export default router;
