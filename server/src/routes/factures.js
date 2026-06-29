import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { uploadDocument as uploadDoc, requireCloudinary } from '../utils/cloudinary.js';
import * as ctrl from '../controllers/factures.controller.js';

const router = Router();

const roles = ['pharmacien', 'admin'];

router.get(
  '/',
  authenticate,
  requireRole(...roles),
  requireModule('fournisseurs'),
  ctrl.getFactures
);

router.get(
  '/tableau-rapprochement',
  authenticate,
  requireRole(...roles),
  ctrl.getTableauRapprochement
);

router.get(
  '/:id',
  authenticate,
  requireRole(...roles),
  ctrl.getFacture
);

router.post(
  '/',
  authenticate,
  requireRole(...roles),
  requireModule('fournisseurs'),
  ctrl.createFacture
);

router.put(
  '/:id/statut',
  authenticate,
  requireRole(...roles),
  ctrl.updateFactureStatut
);

router.put(
  '/:id/document',
  authenticate,
  requireRole(...roles),
  requireCloudinary,
  uploadDoc.single('fichier'),
  ctrl.uploadDocumentFacture
);

export default router;
