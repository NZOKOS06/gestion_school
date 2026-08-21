import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/calendrierScolaire.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant', 'comptable'];
const writeRoles = ['directeur', 'directeur_etudes'];

router.get('/',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  ctrl.getAll
);

router.get('/alertes',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  ctrl.getAlertes
);

router.post('/',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.remove
);

export default router;
