import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { paiementValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/paiements.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('paiements'),
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('paiements'),
  idParamValidator,
  ctrl.getById
);

router.get('/:id/recu',
  authenticate,
  requireRole('directeur', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('paiements'),
  idParamValidator,
  ctrl.getRecu
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'comptable'),
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
