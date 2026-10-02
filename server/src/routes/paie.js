import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/paie.controller.js';

const router = Router();

// Calcul, ajustement, validation et décaissement : direction et gestionnaire
const gestion = ['directeur', 'comptable'];
// Ouverture de la période (mois écoulé, à partir du jour de paie) : directeur ou secrétaire
const ouverture = ['directeur', 'secretaire'];
const lecture = ['directeur', 'comptable', 'secretaire'];

router.use(authenticate, requireTenantMatch, requireModule('paie'));

router.get('/prochaine', requireRole(...lecture), ctrl.getProchaine);
router.get('/periodes', requireRole(...lecture), ctrl.listPeriodes);
router.post('/periodes/ouvrir', requireRole(...ouverture), ctrl.ouvrirPeriode);
router.post('/periodes/:id/calculer', requireRole(...gestion), idParamValidator, ctrl.calculerPeriode);
router.get('/periodes/:periodePaieId/bulletins', requireRole(...lecture), ctrl.listBulletins);
router.put('/bulletins/:id', requireRole(...gestion), idParamValidator, ctrl.updateBulletin);
router.post('/bulletins/:id/valider', requireRole(...gestion), idParamValidator, ctrl.validerBulletin);
router.post('/periodes/:id/valider', requireRole(...gestion), idParamValidator, ctrl.validerPeriode);
router.post('/periodes/:id/payer', requireRole(...gestion), idParamValidator, ctrl.marquerPayee);

export default router;
