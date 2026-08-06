import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/enseignant.controller.js';

const router = Router();

router.use(authenticate, requireRole('enseignant'), requireTenantMatch);

router.get('/dashboard', ctrl.getDashboard);
router.get('/mes-classes', ctrl.getMesClasses);
router.get('/evaluations', ctrl.getEvaluations);
router.get('/cours-aujourdhui', ctrl.getCoursAujourdhui);
router.get('/emploi-du-temps', ctrl.getEmploiDuTemps);

export default router;
