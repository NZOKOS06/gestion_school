import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/bulletins.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant'),
  requireTenantMatch,
  requireModule('bulletins'),
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant'),
  requireTenantMatch,
  requireModule('bulletins'),
  idParamValidator,
  ctrl.getById
);

router.post('/generate',
  authenticate,
  requireRole('directeur', 'enseignant'),
  requireTenantMatch,
  requireModule('bulletins'),
  ctrl.generate
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'enseignant'),
  requireTenantMatch,
  requireModule('bulletins'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('bulletins'),
  idParamValidator,
  ctrl.remove
);

export default router;
