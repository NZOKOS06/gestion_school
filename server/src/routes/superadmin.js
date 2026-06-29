import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/superadmin.controller.js';
import * as auditCtrl from '../controllers/audit.controller.js';
import { requireCloudinary } from '../utils/cloudinary.js';
import { verifySmtpConnection } from '../services/email.service.js';

const router = Router();
router.use(authenticate, requireRole('super_admin'));

router.get('/tenants', paginationValidator, ctrl.getTenants);
router.get('/tenants/:id', idParamValidator, ctrl.getTenantById);
router.post('/tenants', ctrl.createTenant);
router.put('/tenants/:id', idParamValidator, ctrl.updateTenant);
router.put('/tenants/:id/config', idParamValidator, ctrl.updateTenantConfig);
router.put('/tenants/:id/config/logo', idParamValidator, requireCloudinary, ctrl.uploadLogo);
router.put('/tenants/:id/config/background', idParamValidator, requireCloudinary, ctrl.uploadBackgroundImage);
router.put('/tenants/:id/config/hero', idParamValidator, requireCloudinary, ctrl.uploadHeroImage);
router.put('/tenants/:id/config/features', idParamValidator, requireCloudinary, ctrl.uploadFeaturesImage);
router.put('/tenants/:id/config/about', idParamValidator, requireCloudinary, ctrl.uploadAboutImage);
router.put('/tenants/:id/config/hero-video', idParamValidator, requireCloudinary, ctrl.uploadHeroVideo);
router.put('/tenants/:id/config/features-video', idParamValidator, requireCloudinary, ctrl.uploadFeaturesVideo);
router.put('/tenants/:id/config/about-video', idParamValidator, requireCloudinary, ctrl.uploadAboutVideo);
router.delete('/tenants/:id', idParamValidator, ctrl.deleteTenant);
router.get('/tenants/:id/staff', idParamValidator, ctrl.getTenantStaff);
router.post('/tenants/:id/staff', idParamValidator, ctrl.createTenantStaff);
router.get('/stats', ctrl.getStats);

// Audit & traçabilité
router.get('/audit', paginationValidator, auditCtrl.getAuditLogs);
router.get('/audit/stats', auditCtrl.getAuditStats);

// Diagnostic SMTP
router.get('/smtp-status', async (req, res) => {
  const status = await verifySmtpConnection();
  res.json({
    host: process.env.SMTP_HOST || null,
    port: process.env.SMTP_PORT || null,
    configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    ...status
  });
});

export default router;
