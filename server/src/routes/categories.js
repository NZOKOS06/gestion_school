import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import * as ctrl from '../controllers/categories.controller.js';

const router = Router();

router.get('/', authenticate, requireRole('pharmacien', 'admin', 'vendeur'), requireTenantMatch, requireModule('catalogue'), ctrl.getAll);
router.post('/', authenticate, requireRole('pharmacien', 'admin'), requireTenantMatch, requireModule('catalogue'), ctrl.create);
router.put('/:id', authenticate, requireRole('pharmacien', 'admin'), requireTenantMatch, ctrl.update);
router.delete('/:id', authenticate, requireRole('pharmacien', 'admin'), requireTenantMatch, ctrl.remove);

export default router;
