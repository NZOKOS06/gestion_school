import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { inscriptionValidator, inscriptionAvecEleveValidator, paginationValidator, idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/inscriptions.controller.js';

const router = Router();

router.get('/',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('inscriptions'),
  paginationValidator,
  ctrl.getAll
);

router.get('/eligibles-reinscription',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire'),
  requireTenantMatch,
  requireModule('inscriptions'),
  ctrl.eligiblesReinscription
);

router.post('/reinscription-lot',
  authenticate,
  requireRole('directeur', 'directeur_etudes'),
  requireTenantMatch,
  requireModule('inscriptions'),
  ctrl.reinscriptionLot
);

router.get('/frais-preview',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('inscriptions'),
  ctrl.fraisPreview
);

// Tarif spécial (cas sociaux, remise) — motif obligatoire, tracé dans l'audit
router.put('/:id/tarif',
  authenticate,
  requireRole('directeur', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.updateTarif
);

// Services optionnels (cantine, garderie, TD…) : consultation, souscription, arrêt, tarif spécial
router.get('/:id/services',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.getServicesInscription
);

router.put('/:id/services/:serviceId',
  authenticate,
  requireRole('directeur', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.updateServiceInscription
);

// Famille : tuteur, espace parent, accès aux notes
router.get('/:id/famille',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.getFamille
);

// Dérogation : notes / bulletins visibles malgré un impayé (directeur uniquement)
router.put('/:id/derogation-notes',
  authenticate,
  requireRole('directeur'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.setDerogationNotes
);

router.post('/avec-eleve',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire'),
  requireTenantMatch,
  requireModule('inscriptions'),
  inscriptionAvecEleveValidator,
  ctrl.createAvecEleve
);

router.get('/:id',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire', 'comptable'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.getById
);

router.post('/',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire'),
  requireTenantMatch,
  requireModule('inscriptions'),
  inscriptionValidator,
  ctrl.create
);

router.put('/:id',
  authenticate,
  requireRole('directeur', 'directeur_etudes', 'secretaire'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.update
);

router.put('/:id/decision-fin-annee',
  authenticate,
  requireRole('directeur', 'directeur_etudes'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.decideFinAnnee
);

router.put('/:id/validate',
  authenticate,
  requireRole('directeur', 'secretaire', 'directeur_etudes'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.validate
);

router.delete('/:id',
  authenticate,
  requireRole('directeur', 'secretaire'),
  requireTenantMatch,
  requireModule('inscriptions'),
  idParamValidator,
  ctrl.remove
);

export default router;
