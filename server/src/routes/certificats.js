import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/certificats.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'comptable'];
const writeRoles = ['directeur', 'directeur_etudes', 'secretaire'];

router.get('/',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  requireModule('certificats'),
  paginationValidator,
  ctrl.getAll
);

router.get('/preview',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  requireModule('certificats'),
  ctrl.preview
);

router.get('/:id/pdf',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  requireModule('certificats'),
  idParamValidator,
  ctrl.getPdf
);

router.get('/:id',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  requireModule('certificats'),
  idParamValidator,
  ctrl.getOne
);

router.post('/',
  authenticate,
  requireRole(...writeRoles),
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
