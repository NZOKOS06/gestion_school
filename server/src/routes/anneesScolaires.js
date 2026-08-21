import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { anneeScolaireValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/anneesScolaires.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'comptable'];
const writeRoles = ['directeur', 'directeur_etudes'];

router.get('/',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  ctrl.getAll
);

router.get('/:id',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  anneeScolaireValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.update
);

router.put('/:id/activate',
  authenticate,
  requireRole('directeur', 'directeur_etudes'),
  requireTenantMatch,
  idParamValidator,
  ctrl.activate
);

router.post('/:id/dupliquer',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.dupliquer
);

router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  idParamValidator,
  ctrl.remove
);

export default router;
