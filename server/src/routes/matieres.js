import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { matiereValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/matieres.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant'];
const writeRoles = ['directeur', 'directeur_etudes', 'secretaire'];

router.get('/',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  paginationValidator,
  ctrl.getAll
);

router.delete('/affectations/:affId',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  ctrl.deleteAffectation
);

router.get('/:id/affectations',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.getAffectations
);

router.post('/:id/affectations',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.createAffectation
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
  matiereValidator,
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
  requireRole('directeur', 'directeur_etudes'),
  requireTenantMatch,
  idParamValidator,
  ctrl.remove
);

export default router;
