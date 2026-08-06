import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/conseilDeClasse.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant'];
const writeRoles = ['directeur', 'directeur_etudes', 'secretaire', 'surveillant'];

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
  ctrl.getOne
);

router.post('/',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.update
);

router.post('/:id/participants',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.addParticipant
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'directeur_etudes'),
  requireTenantMatch,
  idParamValidator,
  ctrl.remove
);

export default router;
