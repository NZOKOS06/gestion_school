import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/messages.controller.js';

const router = Router();

router.get('/inbox',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable', 'parent'),
  requireTenantMatch,
  ctrl.getInbox
);

router.get('/sent',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable', 'parent'),
  requireTenantMatch,
  ctrl.getSent
);

router.post('/',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable'),
  requireTenantMatch,
  ctrl.send
);

router.put('/:id/read',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable', 'parent'),
  requireTenantMatch,
  idParamValidator,
  ctrl.markAsRead
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable', 'parent'),
  requireTenantMatch,
  idParamValidator,
  ctrl.remove
);

export default router;
