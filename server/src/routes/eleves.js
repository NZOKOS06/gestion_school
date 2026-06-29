import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { eleveValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/eleves.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable'),
  requireTenantMatch,
  requireModule('eleves'),
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable'),
  requireTenantMatch,
  requireModule('eleves'),
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('eleves'),
  eleveValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('eleves'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('eleves'),
  idParamValidator,
  ctrl.remove
);

export default router;
