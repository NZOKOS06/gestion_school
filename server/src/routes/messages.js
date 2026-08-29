import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/messages.controller.js';

const router = Router();

const roles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant', 'comptable', 'parent'];

router.get('/recipients',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  ctrl.getRecipients
);

router.get('/inbox',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  ctrl.getInbox
);

router.get('/sent',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  ctrl.getSent
);

router.get('/archives',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  ctrl.getArchives
);

router.get('/:id',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  ctrl.send
);

router.put('/:id/read',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  idParamValidator,
  ctrl.markAsRead
);

router.put('/:id/archive',
  authenticate,
  requireRole(...roles),
  requireTenantMatch,
  idParamValidator,
  ctrl.archiveMessage
);

export default router;
