import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/parentsList.controller.js';

const router = Router();

const adminRoles = ['directeur', 'directeur_etudes', 'secretaire'];

router.get('/',
  authenticate,
  requireRole(...adminRoles),
  requireTenantMatch,
  ctrl.getAll
);

router.post('/',
  authenticate,
  requireRole(...adminRoles),
  requireTenantMatch,
  ctrl.create
);

export default router;
