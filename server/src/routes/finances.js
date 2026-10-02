import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/ventes.controller.js';

// Catégories de recettes et de dépenses gérées par l'école
const router = Router();

router.use(authenticate, requireTenantMatch, requireModule('paiements'));

router.get('/categories', requireRole('directeur', 'comptable', 'secretaire'), ctrl.listCategories);
router.post('/categories', requireRole('directeur', 'comptable'), ctrl.createCategorie);
router.put('/categories/:id', requireRole('directeur', 'comptable'), idParamValidator, ctrl.updateCategorie);
router.delete('/categories/:id', requireRole('directeur', 'comptable'), idParamValidator, ctrl.deleteCategorie);

export default router;
