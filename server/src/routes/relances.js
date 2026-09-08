import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/relances.controller.js';

const router = Router();

const financeRoles = ['directeur', 'directeur_etudes', 'comptable', 'secretaire'];
const scolariteRoles = ['directeur', 'directeur_etudes', 'surveillant', 'secretaire'];
const readRoles = ['directeur', 'directeur_etudes', 'comptable', 'secretaire', 'surveillant'];

// POST /api/relances/paiements — déclencher relance des échéances impayées
router.post(
  '/paiements',
  authenticate,
  requireRole(...financeRoles),
  requireTenantMatch,
  ctrl.relancerPaiements
);

// POST /api/relances/absences — déclencher alerte absences de la semaine
router.post(
  '/absences',
  authenticate,
  requireRole(...scolariteRoles),
  requireTenantMatch,
  ctrl.relancerAbsences
);

// POST /api/relances/bulletins — notifier les parents de la disponibilité des bulletins
router.post(
  '/bulletins',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire'),
  requireTenantMatch,
  ctrl.relancerBulletins
);

// GET /api/relances/historique — journal paginé des relances
router.get(
  '/historique',
  authenticate,
  requireRole(...readRoles),
  requireTenantMatch,
  ctrl.getHistorique
);

export default router;
