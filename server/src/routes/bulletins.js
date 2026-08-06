import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/bulletins.controller.js';

const router = Router();

const staffRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant'];
const genRoles = ['directeur', 'directeur_etudes', 'enseignant'];

router.get('/',
  authenticate,
  requireRole(...staffRoles),
  requireTenantMatch,
  requireModule('bulletins'),
  paginationValidator,
  ctrl.getAll
);

router.post('/calculer',
  authenticate,
  requireRole(...genRoles),
  requireTenantMatch,
  requireModule('bulletins'),
  ctrl.calculer
);

router.post('/generer-masse',
  authenticate,
  requireRole(...genRoles),
  requireTenantMatch,
  requireModule('bulletins'),
  ctrl.genererMasse
);

router.put('/publier',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('bulletins'),
  ctrl.publier
);

router.post('/generate',
  authenticate,
  requireRole(...genRoles),
  requireTenantMatch,
  requireModule('bulletins'),
  ctrl.generate
);

router.get('/:id',
  authenticate,
  requireRole(...staffRoles),
  requireTenantMatch,
  requireModule('bulletins'),
  idParamValidator,
  ctrl.getById
);

router.put('/:id',
  authenticate,
  requireRole(...genRoles),
  requireTenantMatch,
  requireModule('bulletins'),
  idParamValidator,
  ctrl.update
);

router.delete('/:id',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('bulletins'),
  idParamValidator,
  ctrl.remove
);

export default router;
