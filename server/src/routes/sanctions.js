import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { sanctionValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/sanctions.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'surveillant'),
  requireTenantMatch,
  requireModule('sanctions'),
  paginationValidator,
  ctrl.getAll
);

router.post('/',
  authenticate,
  requireRole('directeur', 'surveillant'),
  requireTenantMatch,
  requireModule('sanctions'),
  sanctionValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'surveillant'),
  requireTenantMatch,
  requireModule('sanctions'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('sanctions'),
  idParamValidator,
  ctrl.remove
);

export default router;
