import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { inscriptionValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/inscriptions.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('inscriptions'),
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('inscriptions'),
  inscriptionValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.update
);

router.put('/:id/validate',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.validate
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.remove
);

export default router;
