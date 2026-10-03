import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/groupeEcole.controller.js';

const router = Router();
router.use(authenticate, requireTenantMatch);

// Tout le personnel : savoir s'il appartient à un groupe et changer de site s'il y est autorisé
router.get('/', ctrl.monGroupe);
router.get('/sites', ctrl.mesSites);
router.post('/changer-site', ctrl.changerSite);

// Directeur de groupe uniquement (le contrôleur vérifie l'identité)
router.get('/stats', requireRole('directeur'), ctrl.statsMonGroupe);
router.post('/partager-tarifs', requireRole('directeur'), ctrl.partagerTarifs);
router.post('/transferts', requireRole('directeur'), ctrl.transfererEleve);
router.get('/acces', requireRole('directeur'), ctrl.listerAcces);
router.post('/acces', requireRole('directeur'), ctrl.accorderAcces);
router.delete('/acces/:id', requireRole('directeur'), ctrl.retirerAcces);

export default router;
