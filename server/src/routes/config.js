import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { requireCloudinary } from '../utils/cloudinary.js';
import * as ctrl from '../controllers/config.controller.js';
import { uploadMemoire, analyserDocument } from '../controllers/documentAnalyse.controller.js';

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


// POST /api/config/:slug/analyser-document — analyse IA d'un document existant (proposition à valider)
router.post(
  '/:slug/analyser-document',
  authenticate,
  requireRole('directeur', 'super_admin'),
  uploadMemoire,
  analyserDocument
);
export default router;
