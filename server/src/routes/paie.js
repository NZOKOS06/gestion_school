import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/paie.controller.js';

const router = Router();

const roles = ['directeur', 'comptable'];

router.get('/periodes',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('paie'),
  ctrl.listPeriodes
);

router.post('/periodes',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('paie'),
  ctrl.getOrCreatePeriode
);

router.post('/periodes/:id/calculer',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('paie'),
  idParamValidator,
  ctrl.calculerPeriode
);

router.get('/periodes/:periodePaieId/bulletins',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('paie'),
  ctrl.listBulletins
);

router.put('/bulletins/:id',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('paie'),
  idParamValidator,
  ctrl.updateBulletin
);

router.post('/bulletins/:id/valider',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('paie'),
  idParamValidator,
  ctrl.validerBulletin
);

router.post('/periodes/:id/valider',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('paie'),
  idParamValidator,
  ctrl.validerPeriode
);

router.post('/periodes/:id/payer',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('paie'),
  idParamValidator,
  ctrl.marquerPayee
);

export default router;
