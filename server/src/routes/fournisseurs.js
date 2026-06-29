import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { fournisseurValidator, commandeFValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/fournisseurs.controller.js';

const router = Router();

// ========== FOURNISSEURS ==========

// GET /api/fournisseurs
router.get('/',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('fournisseurs'),
  paginationValidator,
  ctrl.getAll
);

// GET /api/fournisseurs/:id
router.get('/:id',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  idParamValidator,
  ctrl.getById
);

// POST /api/fournisseurs
router.post('/',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('fournisseurs'),
  fournisseurValidator,
  ctrl.create
);

// PUT /api/fournisseurs/:id
router.put('/:id',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('fournisseurs'),
  idParamValidator,
  ctrl.update
);

// DELETE /api/fournisseurs/:id
router.delete('/:id',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('fournisseurs'),
  idParamValidator,
  ctrl.remove
);

// ========== COMMANDES FOURNISSEURS ==========

// GET /api/fournisseurs/commandes/liste
router.get('/commandes/liste',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('fournisseurs'),
  ctrl.getCommandes
);

// GET /api/fournisseurs/commandes/:id
router.get('/commandes/:id',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  idParamValidator,
  ctrl.getCommandeById
);

// POST /api/fournisseurs/commandes
router.post('/commandes',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('fournisseurs'),
  commandeFValidator,
  ctrl.createCommande
);

// PUT /api/fournisseurs/commandes/:id/envoyer
router.put('/commandes/:id/envoyer',
  authenticate,
  requireRole('pharmacien', 'admin'),
  requireTenantMatch,
  requireModule('fournisseurs'),
  idParamValidator,
  ctrl.envoyerCommande
);

export default router;
