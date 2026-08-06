import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/referentiel.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'comptable', 'surveillant'];
const writeRoles = ['directeur', 'directeur_etudes', 'secretaire'];

router.get('/versions', authenticate, requireRole(...readRoles), requireTenantMatch, ctrl.listVersions);
router.get('/niveaux', authenticate, requireRole(...readRoles), requireTenantMatch, ctrl.listNiveaux);
router.get('/filieres', authenticate, requireRole(...readRoles), requireTenantMatch, ctrl.listFilieres);
router.get('/periodes', authenticate, requireRole(...readRoles), requireTenantMatch, ctrl.listPeriodes);
router.post('/periodes', authenticate, requireRole(...writeRoles), requireTenantMatch, ctrl.upsertPeriode);
router.put('/periodes/:id', authenticate, requireRole(...writeRoles), requireTenantMatch, ctrl.upsertPeriode);
router.delete('/periodes/:id', authenticate, requireRole('directeur', 'directeur_etudes'), requireTenantMatch, ctrl.deletePeriode);
router.post('/calendrier/generate-from-periodes', authenticate, requireRole(...writeRoles), requireTenantMatch, ctrl.generateCalendrierFromPeriodes);

export default router;
