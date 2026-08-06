import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { evaluationValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/evaluations.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant'];
const writeRoles = ['directeur', 'directeur_etudes', 'enseignant'];

router.get('/',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  requireModule('notes'),
  paginationValidator,
  ctrl.getAll
);

router.post('/',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  requireModule('notes'),
  evaluationValidator,
  ctrl.create
);

router.get('/:id/notes',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  requireModule('notes'),
  idParamValidator,
  ctrl.getNotes
);

router.post('/:id/notes',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  requireModule('notes'),
  idParamValidator,
  ctrl.saveNotes
);

router.get('/:id',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  requireModule('notes'),
  idParamValidator,
  ctrl.getById
);

router.put('/:id',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  requireModule('notes'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  requireModule('notes'),
  idParamValidator,
  ctrl.remove
);

export default router;
