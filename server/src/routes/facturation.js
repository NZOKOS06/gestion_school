import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/facturation.controller.js';

const router = Router();

const financeAdminRoles = ['directeur', 'comptable'];

// GET /api/facturation/preview — Aperçu du calcul de facturation indexée
router.get(
  '/preview',
  authenticate,
  requireRole(...financeAdminRoles),
  requireTenantMatch,
  ctrl.getPreview
);

// POST /api/facturation/generer — Génération en masse des échéances
router.post(
  '/generer',
  authenticate,
  requireRole(...financeAdminRoles),
  requireTenantMatch,
  ctrl.generer
);

// GET /api/facturation/historique — Historique des générations de facturation
router.get(
  '/historique',
  authenticate,
  requireRole(...financeAdminRoles),
  requireTenantMatch,
  ctrl.getHistorique
);

export default router;
