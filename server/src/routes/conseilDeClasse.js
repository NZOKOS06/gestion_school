import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/conseilDeClasse.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant'),
  requireTenantMatch,
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant'),
  requireTenantMatch,
  idParamValidator,
  ctrl.getOne
);

router.post('/',
  authenticate,
  requireRole('directeur', 'surveillant'),
  requireTenantMatch,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'surveillant'),
  requireTenantMatch,
  idParamValidator,
  ctrl.update
);

router.post('/:id/participants',
  authenticate,
  requireRole('directeur', 'surveillant'),
  requireTenantMatch,
  idParamValidator,
  ctrl.addParticipant
);

router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  idParamValidator,
  ctrl.remove
);

export default router;
