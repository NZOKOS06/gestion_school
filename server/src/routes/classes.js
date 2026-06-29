import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { classeValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/classes.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable'),
  requireTenantMatch,
  requireModule('classes'),
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable'),
  requireTenantMatch,
  requireModule('classes'),
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('classes'),
  classeValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('classes'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('classes'),
  idParamValidator,
  ctrl.remove
);

export default router;
