import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/annonces.controller.js';

const router = Router();

// Annonces de l'école vers les espaces parents (module Parents)
router.use(
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire'),
  requireTenantMatch,
  requireModule('parents'),
);

router.get('/', ctrl.list);
router.get('/apercu', ctrl.apercu);
router.post('/', ctrl.create);
router.delete('/:id', idParamValidator, ctrl.remove);

export default router;
