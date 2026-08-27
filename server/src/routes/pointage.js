import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/pointage.controller.js';

const router = Router();

const roles = ['directeur', 'directeur_etudes', 'surveillant'];

router.get('/sessions',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('pointagePersonnel'),
  ctrl.getSessions
);

router.get('/mes-sessions',
  authenticate,
  requireRole('enseignant'),
  requireTenantMatch,
  requireModule('pointagePersonnel'),
  ctrl.getMesSessions
);

router.post('/sessions/:id/arrivee',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('pointagePersonnel'),
  idParamValidator,
  ctrl.arrivee
);

router.post('/sessions/:id/depart',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('pointagePersonnel'),
  idParamValidator,
  ctrl.depart
);

router.post('/sessions/:id/absent',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('pointagePersonnel'),
  idParamValidator,
  ctrl.marquerAbsent
);

router.post('/device/scan',
  requireModule('pointagePersonnel'),
  ctrl.deviceScan
);

export default router;
