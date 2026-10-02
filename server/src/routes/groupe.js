import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/groupeEcole.controller.js';

const router = Router();
router.use(authenticate, requireTenantMatch, requireRole('directeur'));

router.get('/', ctrl.monGroupe);
router.get('/stats', ctrl.statsMonGroupe);
router.post('/partager-tarifs', ctrl.partagerTarifs);
router.post('/transferts', ctrl.transfererEleve);

export default router;
