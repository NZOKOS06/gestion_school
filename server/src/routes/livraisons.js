import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { livraisonValidator, statutLivraisonValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/livraisons.controller.js';

const router = Router();

// GET /api/livraisons
router.get('/',
  authenticate,
  requireRole('pharmacien', 'admin', 'livreur'),
  requireTenantMatch,
  requireModule('livraison'),
  ctrl.getAll
);

// GET /api/livraisons/:id
router.get('/:id',
  authenticate,
  requireRole('pharmacien', 'admin', 'livreur', 'client'),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

// POST /api/livraisons (créer une livraison pour une vente)
router.post('/',
  authenticate,
  requireRole('pharmacien', 'admin', 'vendeur'),
  requireTenantMatch,
  requireModule('livraison'),
  livraisonValidator,
  ctrl.create
);

// PUT /api/livraisons/:id/statut (pour livreur)
router.put('/:id/statut',
  authenticate,
  requireRole('livreur', 'pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('livraison'),
  statutLivraisonValidator,
  ctrl.updateStatut
);

// PUT /api/livraisons/:id/assigner
router.put('/:id/assigner',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('livraison'),
  ctrl.assigner
);

export default router;
