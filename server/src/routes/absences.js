import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { absenceValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/absences.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant'),
  requireTenantMatch,
  requireModule('absences'),
  paginationValidator,
  ctrl.getAll
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant'),
  requireTenantMatch,
  requireModule('absences'),
  absenceValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant'),
  requireTenantMatch,
  requireModule('absences'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'surveillant'),
  requireTenantMatch,
  requireModule('absences'),
  idParamValidator,
  ctrl.remove
);

export default router;
