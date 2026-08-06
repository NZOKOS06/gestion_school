import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/examens.controller.js';

const router = Router();

const readRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant'];
const writeRoles = ['directeur', 'directeur_etudes', 'secretaire'];

router.get('/sessions', authenticate, requireRole(...readRoles), requireTenantMatch, ctrl.listSessions);
router.post('/sessions', authenticate, requireRole(...writeRoles), requireTenantMatch, ctrl.createSession);
router.get('/sessions/:sessionId/candidatures', authenticate, requireRole(...readRoles), requireTenantMatch, ctrl.listCandidatures);
router.post('/sessions/:sessionId/candidatures', authenticate, requireRole(...writeRoles), requireTenantMatch, ctrl.addCandidature);
router.put('/candidatures/:candidatureId/resultat', authenticate, requireRole(...writeRoles), requireTenantMatch, ctrl.setResultat);

export default router;
