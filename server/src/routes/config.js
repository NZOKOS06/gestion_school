import { Router } from 'express';
import * as ctrl from '../controllers/config.controller.js';

const router = Router();

// GET /api/config/:slug - Configuration publique du tenant
router.get('/:slug', ctrl.getBySlug);

export default router;
