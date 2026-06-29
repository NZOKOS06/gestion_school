import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { venteValidator, encaissementValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/ventes.controller.js';

const router = Router();

/**
 * @swagger
 * /api/ventes:
 *   post:
 *     summary: Créer une nouvelle vente
 *     tags: [Ventes]
 *     parameters:
 *       - $ref: '#/components/parameters/TenantSlug'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lignes]
 *             properties:
 *               nomClient:
 *                 type: string
 *                 example: Patient Dupont
 *               telephoneClient:
 *                 type: string
 *               lignes:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/LigneVente'
 *                 minItems: 1
 *     responses:
 *       201:
 *         description: Vente créée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 vente:
 *                   $ref: '#/components/schemas/Vente'
 *       400:
 *         description: Stock insuffisant ou médicament inactif
 *   get:
 *     summary: Lister les ventes
 *     tags: [Ventes]
 *     parameters:
 *       - $ref: '#/components/parameters/TenantSlug'
 *       - in: query
 *         name: statut
 *         schema:
 *           type: string
 *           enum: [en_cours, finalisee, annulee]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste des ventes
 */
// GET /api/ventes
router.get('/',
  authenticate,
  requireRole('pharmacien', 'admin', 'vendeur', 'caissier'),
  requireTenantMatch,
  requireModule('ventes'),
  ctrl.getAll
);

// GET /api/ventes/mes-ventes (pour vendeur)
router.get('/mes-ventes',
  authenticate,
  requireRole('vendeur', 'preparateur', 'caissier'),
  requireTenantMatch,
  requireModule('ventes'),
  ctrl.getMesVentes
);

// GET /api/ventes/:id
router.get('/:id',
  authenticate,
  requireRole('pharmacien', 'admin', 'vendeur', 'caissier'),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

// POST /api/ventes
router.post('/',
  authenticate,
  requireRole('vendeur', 'preparateur', 'caissier', 'pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('ventes'),
  venteValidator,
  ctrl.create
);

// POST /api/ventes/:id/encaisser
router.post('/:id/encaisser',
  authenticate,
  requireRole('caissier', 'pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('ventes'),
  encaissementValidator,
  ctrl.encaisser
);

// PUT /api/ventes/:id/annuler
router.put('/:id/annuler',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('ventes'),
  idParamValidator,
  ctrl.annuler
);

export default router;
