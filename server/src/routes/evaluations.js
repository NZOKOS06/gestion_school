import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { evaluationValidator, noteValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/evaluations.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant'),
  requireTenantMatch,
  requireModule('notes'),
  paginationValidator,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant'),
  requireTenantMatch,
  requireModule('notes'),
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole('directeur', 'enseignant'),
  requireTenantMatch,
  requireModule('notes'),
  evaluationValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'enseignant'),
  requireTenantMatch,
  requireModule('notes'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'enseignant'),
  requireTenantMatch,
  requireModule('notes'),
  idParamValidator,
  ctrl.remove
);

router.post('/:id/notes',
  authenticate,
  requireRole('directeur', 'enseignant'),
  requireTenantMatch,
  requireModule('notes'),
  idParamValidator,
  ctrl.saveNotes
);

export default router;
