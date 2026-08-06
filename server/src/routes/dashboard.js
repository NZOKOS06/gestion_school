import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import * as ctrl from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/kpis',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant', 'comptable'),
  requireTenantMatch,
  ctrl.getKpis
);

router.get('/caisse',
  authenticate,
  requireRole('comptable', 'directeur'),
  requireTenantMatch,
  requireModule('paiements'),
  ctrl.getCaisse
);

router.get('/evolution',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('paiements'),
  ctrl.getEvolution
);

export default router;
