import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { requireTenantMatch } from '../middleware/authMiddleware.js';
import { depenseValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/depenses.controller.js';

const router = Router();
const financeRoles = ['directeur', 'comptable'];

router.get('/', authenticate, requireRole(...financeRoles), requireTenantMatch, ctrl.getAll);
router.get('/stats', authenticate, requireRole(...financeRoles), requireTenantMatch, ctrl.getStats);
router.get('/export-pdf', authenticate, requireRole(...financeRoles), requireTenantMatch, ctrl.getExportPdf);
router.post('/', authenticate, requireRole(...financeRoles), requireTenantMatch, depenseValidator, ctrl.create);
router.put('/:id', authenticate, requireRole(...financeRoles), requireTenantMatch, idParamValidator, depenseValidator, ctrl.update);
router.delete('/:id', authenticate, requireRole(...financeRoles), requireTenantMatch, idParamValidator, ctrl.remove);

export default router;
