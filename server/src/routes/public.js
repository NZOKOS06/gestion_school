import { Router } from 'express';
import * as ctrl from '../controllers/public.controller.js';

const router = Router();

// GET /api/public/actualites — actualités publiques (sans auth)
router.get('/actualites', ctrl.getActualites);

// GET /api/public/infos — infos école (sans auth)
router.get('/infos', ctrl.getInfosEcole);

export default router;
