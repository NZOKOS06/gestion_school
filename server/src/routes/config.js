import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { requireCloudinary } from '../utils/cloudinary.js';
import * as ctrl from '../controllers/config.controller.js';

const router = Router();

// GET /api/config/:slug — Configuration publique du tenant
router.get('/:slug', ctrl.getBySlug);

// PUT /api/config/:slug — Mise à jour (directeur / super_admin)
router.put(
  '/:slug',
  authenticate,
  requireRole('directeur', 'super_admin'),
  ctrl.updateBySlug
);

// POST /api/config/:slug/logo — Upload logo
router.post(
  '/:slug/logo',
  authenticate,
  requireRole('directeur', 'super_admin'),
  requireCloudinary,
  ctrl.uploadLogoBySlug
);

export default router;
