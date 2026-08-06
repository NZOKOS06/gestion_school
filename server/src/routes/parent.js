import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/parent.controller.js';

const router = Router();

router.use(authenticate, requireRole('parent'), requireTenantMatch);

router.get('/dashboard', ctrl.getDashboard);
router.get('/mes-enfants', ctrl.getMesEnfants);
router.get('/enfants/:id', ctrl.getEnfantDetail);
router.get('/enfants/:id/bulletins', ctrl.getEnfantBulletins);
router.get('/enfants/:id/echeances', ctrl.getEnfantEcheances);
router.get('/enfants/:id/paiements', ctrl.getEnfantPaiements);
router.post('/enfants/:id/paiements/init', ctrl.initMomoPayment);
router.post('/paiements/:ref/confirm', ctrl.confirmMomoPayment);
router.get('/enfants/:id/absences', ctrl.getEnfantAbsences);
router.get('/enfants/:id/sanctions', ctrl.getEnfantSanctions);
router.get('/notifications', ctrl.getNotifications);
router.put('/notifications/read-all', ctrl.markAllNotificationsRead);
router.put('/notifications/:id/read', ctrl.markNotificationRead);

export default router;
