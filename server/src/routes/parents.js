import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/parentsList.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant', 'comptable'];
const writeRoles = ['directeur', 'directeur_etudes', 'secretaire'];

router.get('/',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  ctrl.getAll
);

router.post('/',
  authenticate,
  requireRole(...writeRoles),
  requireTenantMatch,
  ctrl.create
);

export default router;
