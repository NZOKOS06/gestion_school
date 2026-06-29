import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/stock.controller.js';

const router = Router();

/**
 * @swagger
 * /api/stock/ajustement:
 *   post:
 *     summary: Ajuster le stock d'un médicament
 *     tags: [Stock]
 *     parameters:
 *       - $ref: '#/components/parameters/TenantSlug'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [medicamentId, quantiteAjustee, motif]
 *             properties:
 *               medicamentId:
 *                 type: string
 *                 format: uuid
 *               quantiteAjustee:
 *                 type: integer
 *                 description: Quantité à ajouter (positif) ou retirer (négatif)
 *               motif:
 *                 type: string
 *                 example: Casse
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ajustement effectué
 *       400:
 *         description: Données invalides
 */
// POST /api/stock/ajustement
router.post('/ajustement',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('stock'),
  ctrl.ajustement
);

/**
 * @swagger
 * /api/stock/alertes:
 *   get:
 *     summary: Obtenir les alertes de stock
 *     tags: [Stock]
 *     parameters:
 *       - $ref: '#/components/parameters/TenantSlug'
 *     responses:
 *       200:
 *         description: Liste des alertes (ruptures, péremptions)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ruptures:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Medicament'
 *                 perimes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Medicament'
 */
// GET /api/stock/alertes
router.get('/alertes',
  authenticate,
  requireRole('pharmacien', 'admin', 'vendeur', 'preparateur'),
  requireTenantMatch,
  requireModule('stock'),
  ctrl.getAlertes
);

// GET /api/stock/lots
router.get('/lots',
  authenticate,
  requireRole('pharmacien', 'admin', 'preparateur'),
  requireTenantMatch,
  requireModule('stock'),
  ctrl.getLots
);

// GET /api/stock/mouvements
router.get('/mouvements',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('stock'),
  ctrl.getMouvements
);

// GET /api/stock/suggestions-commande
router.get('/suggestions-commande',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('stock'),
  ctrl.getSuggestionsCommande
);

// POST /api/stock/reception/:commandeId
router.post('/reception/:commandeId',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('fournisseurs'),
  idParamValidator,
  ctrl.reception
);

// GET /api/stock/alertes
router.get('/alertes',
  authenticate,
  requireRole('pharmacien', 'admin', 'vendeur', 'preparateur'),
  requireTenantMatch,
  requireModule('stock'),
  ctrl.getAlertes
);

// PUT /api/stock/lots/:id
router.put('/lots/:id',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('stock'),
  idParamValidator,
  ctrl.updateLot
);

// DELETE /api/stock/lots/:id
router.delete('/lots/:id',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('stock'),
  idParamValidator,
  ctrl.deleteLot
);

// PUT /api/stock/lots/:id/archiver
router.put('/lots/:id/archiver',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('stock'),
  idParamValidator,
  ctrl.archiverLot
);

export default router;
