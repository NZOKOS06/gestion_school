import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { eleveValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/eleves.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant', 'comptable'];
const writeRoles = ['directeur', 'directeur_etudes', 'secretaire'];

router.get('/',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  eleveValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole(...writeRoles),
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
