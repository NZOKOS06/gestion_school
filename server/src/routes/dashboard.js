import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import * as ctrl from '../controllers/dashboard.controller.js';

const router = Router();

/**
 * @swagger
 * /api/dashboard/kpis:
 *   get:
 *     summary: Obtenir les KPIs du tableau de bord
 *     tags: [Dashboard]
 *     parameters:
 *       - $ref: '#/components/parameters/TenantSlug'
 *       - in: query
 *         name: enseignant
 *         schema: { type: boolean }
 *         description: Vue enseignant (restreint aux classes personnelles)
 *     responses:
 *       200:
 *         description: KPIs (élèves, classes, paiements, inscriptions)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 eleves: { type: object }
 *                 classes: { type: object }
 *                 paiements: { type: object }
 *                 alertes: { type: object }
 */
// GET /api/dashboard/kpis
router.get('/kpis',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable'),
  requireTenantMatch,
  ctrl.getKpis
);

// GET /api/dashboard/caisse (pour comptable)
router.get('/caisse',
  authenticate,
  requireRole('comptable', 'directeur'),
  requireTenantMatch,
  requireModule('paiements'),
  ctrl.getCaisse
);

// GET /api/dashboard/evolution (graphiques)
router.get('/evolution',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('paiements'),
  ctrl.getEvolution
);

export default router;
