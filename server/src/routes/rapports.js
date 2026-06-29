import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import * as ctrl from '../controllers/rapports.controller.js';

const router = Router();

/**
 * @swagger
 * /api/rapports:
 *   get:
 *     summary: Obtenir le rapport financier complet
 *     tags: [Rapports]
 *     parameters:
 *       - $ref: '#/components/parameters/TenantSlug'
 *       - in: query
 *         name: periode
 *         schema:
 *           type: string
 *           enum: [7j, 30j, 90j, custom]
 *           default: 30j
 *       - in: query
 *         name: dateDebut
 *         schema: { type: string, format: date }
 *         description: Requis si periode=custom
 *       - in: query
 *         name: dateFin
 *         schema: { type: string, format: date }
 *         description: Requis si periode=custom
 *     responses:
 *       200:
 *         description: Rapport financier (CA, marges, top médicaments, ventes par jour)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 periode:
 *                   type: object
 *                   properties:
 *                     debut: { type: string, format: date-time }
 *                     fin: { type: string, format: date-time }
 *                 ca_total: { type: number }
 *                 ca_evolution_pct: { type: number }
 *                 nb_ventes: { type: integer }
 *                 marge_totale: { type: number }
 *                 marge_pct: { type: number }
 *                 top_medicaments:
 *                   type: array
 *                   items:
 *                     type: object
 *                 ventes_par_jour:
 *                   type: array
 *                   items:
 *                     type: object
 */
// GET /api/rapports — synthèse financière
router.get('/',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('rapports'),
  ctrl.getRapports
);

// GET /api/rapports/export — export CSV ou PDF
router.get('/export',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('rapports'),
  ctrl.exportRapports
);

// GET /api/rapports/ventes
router.get('/ventes',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('rapports'),
  ctrl.getVentes
);

// GET /api/rapports/marges
router.get('/marges',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('rapports'),
  ctrl.getMarges
);

// GET /api/rapports/rotation-stock
router.get('/rotation-stock',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('rapports'),
  ctrl.getRotationStock
);

// GET /api/rapports/fournisseurs
router.get('/fournisseurs',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('fournisseurs'),
  ctrl.getFournisseurs
);

export default router;
