import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/notifications.controller.js';

const router = Router();

const staffRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant', 'comptable'];

router.get('/',
  authenticate,
  requireRole(...staffRoles),
  requireTenantMatch,
  ctrl.getMine
);

router.put('/read-all',
  authenticate,
  requireRole(...staffRoles),
  requireTenantMatch,
  ctrl.markAllRead
);

router.put('/:id/read',
  authenticate,
  requireRole(...staffRoles),
  requireTenantMatch,
  idParamValidator,
  ctrl.markRead
);

export default router;
