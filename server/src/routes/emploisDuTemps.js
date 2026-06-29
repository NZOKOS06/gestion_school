import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { emploiDuTempsValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/emploisDuTemps.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant'),
  requireTenantMatch,
  requireModule('emploiDuTemps'),
  ctrl.getAll
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('emploiDuTemps'),
  emploiDuTempsValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('emploiDuTemps'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('emploiDuTemps'),
  idParamValidator,
  ctrl.remove
);

export default router;
