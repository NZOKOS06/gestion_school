import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/servicesOptionnels.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'comptable'];
const writeRoles = ['directeur', 'secretaire'];

router.use(authenticate, requireTenantMatch, requireModule('inscriptions'));

router.get('/', requireRole(...readRoles), ctrl.list);
router.post('/', requireRole(...writeRoles), ctrl.create);
router.put('/:id', requireRole(...writeRoles), idParamValidator, ctrl.update);
router.delete('/:id', requireRole(...writeRoles), idParamValidator, ctrl.remove);

export default router;
