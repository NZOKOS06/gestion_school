import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/heuresEnseignees.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'comptable'),
  requireTenantMatch,
  requireModule('pointagePersonnel'),
  ctrl.getAll
);

router.put('/:id/valider',
  authenticate,
  requireRole('directeur', 'directeur_etudes'),
  requireTenantMatch,
  requireModule('pointagePersonnel'),
  idParamValidator,
  ctrl.valider
);

router.post('/valider-lot',
  authenticate,
  requireRole('directeur', 'directeur_etudes'),
  requireTenantMatch,
  requireModule('pointagePersonnel'),
  ctrl.validerLot
);

router.put('/:id/rejeter',
  authenticate,
  requireRole('directeur', 'directeur_etudes'),
  requireTenantMatch,
  requireModule('pointagePersonnel'),
  idParamValidator,
  ctrl.rejeter
);

router.put('/:id/ajuster',
  authenticate,
  requireRole('directeur', 'directeur_etudes'),
  requireTenantMatch,
  requireModule('pointagePersonnel'),
  idParamValidator,
  ctrl.ajuster
);

export default router;
