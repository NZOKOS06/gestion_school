import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { eleveValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/eleves.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable'),
  requireTenantMatch,
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable'),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  eleveValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  idParamValidator,
  ctrl.remove
);

export default router;
