import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { paiementValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/paiements.controller.js';

const router = Router();

const financeRoles = ['directeur', 'secretaire', 'comptable'];

router.get('/',
  authenticate,
  requireRole(...financeRoles),
  requireTenantMatch,
  requireModule('paiements'),
  paginationValidator,
  ctrl.getAll
);

router.get('/echeances',
  authenticate,
  requireRole(...financeRoles),
  requireTenantMatch,
  requireModule('paiements'),
  ctrl.getEcheances
);

router.get('/echeances-retard',
  authenticate,
  requireRole(...financeRoles),
  requireTenantMatch,
  requireModule('paiements'),
  ctrl.getEcheancesRetard
);

router.post('/echeances/:id/relance',
  authenticate,
  requireRole(...financeRoles),
  requireTenantMatch,
  requireModule('paiements'),
  ctrl.relancerEcheance
);

router.post('/relances/batch',
  authenticate,
  requireRole('directeur', 'comptable'),
  requireTenantMatch,
  requireModule('paiements'),
  ctrl.batchRelances
);

router.get('/:id/recu-pdf',
  authenticate,
  requireRole(...financeRoles, 'parent'),
  requireTenantMatch,
  requireModule('paiements'),
  idParamValidator,
  ctrl.getRecuPdf
);

router.get('/:id/recu',
  authenticate,
  requireRole(...financeRoles),
  requireTenantMatch,
  requireModule('paiements'),
  idParamValidator,
  ctrl.getRecu
);

router.get('/:id',
  authenticate,
  requireRole(...financeRoles),
  requireTenantMatch,
  requireModule('paiements'),
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole(...financeRoles),
  requireTenantMatch,
  requireModule('paiements'),
  paiementValidator,
  ctrl.create
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'comptable'),
  requireTenantMatch,
  requireModule('paiements'),
  idParamValidator,
  ctrl.remove
);

export default router;
