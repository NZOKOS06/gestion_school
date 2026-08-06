import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import * as ctrl from '../controllers/rapports.controller.js';

const router = Router();

/**
 * @swagger
 * /api/rapports:
 *   get:
 *     summary: Rapport financier scolaire (paiements / scolarités)
 *     tags: [Rapports]
 */
router.get('/',
  authenticate,
  requireRole('directeur', 'comptable', 'secretaire'),
  requireTenantMatch,
  requireModule('rapports'),
  ctrl.getRapports
);

router.get('/export',
  authenticate,
  requireRole('directeur', 'comptable', 'secretaire'),
  requireTenantMatch,
  requireModule('rapports'),
  ctrl.exportRapports
);

export default router;
