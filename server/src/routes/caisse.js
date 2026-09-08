/**
 * routes/caisse.js
 *
 * Routes de gestion de la caisse journalière et forteresse anti-fraude.
 */

import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/caisse.controller.js';

const router = Router();

const caisseRoles = ['directeur', 'secretaire', 'comptable'];
const annulationRoles = ['directeur', 'comptable'];

// ─── Sessions de Caisse ───────────────────────────────────────────────────────

// Ouvrir une nouvelle session de caisse
router.post(
  '/sessions/ouvrir',
  authenticate,
  requireRole(...caisseRoles),
  requireTenantMatch,
  requireModule('paiements'),
  ctrl.ouvrirSession
);

// Obtenir la session courante ouverte
router.get(
  '/sessions/courante',
  authenticate,
  requireRole(...caisseRoles),
  requireTenantMatch,
  requireModule('paiements'),
  ctrl.getSessionCourante
);

// Clôturer une session de caisse avec billetterie
router.post(
  '/sessions/:id/cloturer',
  authenticate,
  requireRole(...caisseRoles),
  requireTenantMatch,
  requireModule('paiements'),
  idParamValidator,
  ctrl.cloturerSession
);

// Liste des sessions de caisse (historique)
router.get(
  '/sessions',
  authenticate,
  requireRole(...caisseRoles),
  requireTenantMatch,
  requireModule('paiements'),
  paginationValidator,
  ctrl.getSessions
);

// ─── Forteresse Anti-Fraude & Annulations ─────────────────────────────────────

// Annuler un paiement avec enregistrement dans l'Append-Only Ledger
router.post(
  '/paiements/:id/annuler',
  authenticate,
  requireRole(...annulationRoles),
  requireTenantMatch,
  requireModule('paiements'),
  idParamValidator,
  ctrl.annulerPaiement
);

// Consulter le journal d'audit immuable des annulations
router.get(
  '/annulations',
  authenticate,
  requireRole(...annulationRoles),
  requireTenantMatch,
  requireModule('paiements'),
  paginationValidator,
  ctrl.getJournalAnnulations
);

export default router;
