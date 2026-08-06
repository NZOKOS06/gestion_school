import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { emploiDuTempsValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/emploisDuTemps.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant'];
const writeRoles = ['directeur', 'directeur_etudes', 'secretaire'];

router.get('/',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  requireModule('emploiDuTemps'),
  ctrl.getAll
);

router.get('/:id/eleves',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  requireModule('emploiDuTemps'),
  idParamValidator,
  ctrl.getEleves
);

router.post('/',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  requireModule('emploiDuTemps'),
  emploiDuTempsValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  requireModule('emploiDuTemps'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  requireModule('emploiDuTemps'),
  idParamValidator,
  ctrl.remove
);

export default router;
