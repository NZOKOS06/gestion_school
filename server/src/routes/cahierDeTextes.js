import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/cahierDeTextes.controller.js';

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
  requireRole('directeur', 'secretaire', 'enseignant'),
  requireTenantMatch,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant'),
  requireTenantMatch,
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'enseignant'),
  requireTenantMatch,
  idParamValidator,
  ctrl.remove
);

export default router;
