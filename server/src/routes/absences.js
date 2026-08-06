import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { absenceValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/absences.controller.js';

const router = Router();

const roles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant'];

router.get('/',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('absences'),
  paginationValidator,
  ctrl.getAll
);

router.post('/appel',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('absences'),
  ctrl.faireAppel
);

router.post('/',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('absences'),
  absenceValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  requireModule('absences'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'surveillant'),
  requireTenantMatch,
  requireModule('absences'),
  idParamValidator,
  ctrl.remove
);

export default router;
