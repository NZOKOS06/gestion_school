import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { matiereValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/matieres.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant'),
  requireTenantMatch,
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant'),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  matiereValidator,
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
