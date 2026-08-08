import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { staffValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/personnel.controller.js';

const router = Router();

// GET /api/staff
router.get('/',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire'),
  requireTenantMatch,
  requireModule('personnel'),
  paginationValidator,
  ctrl.getAll
);

// GET /api/staff/enseignants
router.get('/enseignants',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire', 'enseignant'),
  requireTenantMatch,
  requireModule('personnel'),
  ctrl.getEnseignants
);

// GET /api/staff/profile/me (doit être AVANT /:id)
router.get('/profile/me',
  authenticate,
  requireTenantMatch,
  ctrl.getMe
);

// GET /api/staff/:id
router.get('/:id',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

// POST /api/staff
router.post('/',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire'),
  requireTenantMatch,
  requireModule('personnel'),
  staffValidator,
  ctrl.create
);

// PUT /api/staff/:id — admin RH ou self-profile
router.put('/:id',
  authenticate,
  requireTenantMatch,
  idParamValidator,
  ctrl.update
);

// PUT /api/staff/:id/reset-password
router.put('/:id/reset-password',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('personnel'),
  idParamValidator,
  ctrl.resetPassword
);

// DELETE /api/staff/:id (désactivation)
router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('personnel'),
  idParamValidator,
  ctrl.remove
);

export default router;
