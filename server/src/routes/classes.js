import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { classeValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/classes.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant', 'comptable'];
const writeRoles = ['directeur', 'directeur_etudes', 'secretaire'];

router.get('/',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  requireModule('classes'),
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  requireModule('classes'),
  idParamValidator,
  ctrl.getById
);

router.get('/:id/eleves',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant'),
  requireTenantMatch,
  requireModule('classes'),
  idParamValidator,
  ctrl.getEleves
);

router.post('/',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  requireModule('classes'),
  classeValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  requireModule('classes'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'directeur_etudes'),
  requireTenantMatch,
  requireModule('classes'),
  idParamValidator,
  ctrl.remove
);

export default router;
