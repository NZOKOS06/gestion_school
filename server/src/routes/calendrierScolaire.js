import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/calendrierScolaire.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable'),
  requireTenantMatch,
  ctrl.getAll
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  idParamValidator,
  ctrl.remove
);

export default router;
