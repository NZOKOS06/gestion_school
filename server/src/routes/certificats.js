import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/certificats.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'comptable'),
  requireTenantMatch,
  requireModule('certificats'),
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'comptable'),
  requireTenantMatch,
  requireModule('certificats'),
  idParamValidator,
  ctrl.getOne
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('certificats'),
  ctrl.create
);

router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('certificats'),
  idParamValidator,
  ctrl.remove
);

export default router;
