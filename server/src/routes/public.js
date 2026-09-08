import { Router } from 'express';
import * as ctrl from '../controllers/public.controller.js';

const router = Router();

// GET /api/public/actualites — actualités publiques (sans auth)
router.get('/actualites', ctrl.getActualites);

// GET /api/public/infos — infos école (sans auth)
router.get('/infos', ctrl.getInfosEcole);

// GET /api/public/bulletins/verify/:idOrHash — authenticité bulletin (sans auth)
router.get('/bulletins/verify/:idOrHash', ctrl.verifyBulletin);

// GET /api/public/portail-parent?token=... — accès portail parent via QR Code (sans auth)
router.get('/portail-parent', ctrl.getPortailParent);

export default router;

