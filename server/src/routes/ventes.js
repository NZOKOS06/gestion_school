import { Router } from 'express';
import { authenticate, requireRole, requireTenantMatch } from '../middleware/authMiddleware.js';
import { requireModule } from '../middleware/tenantMiddleware.js';
import { idParamValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/ventes.controller.js';

// Ventes ponctuelles et recettes diverses (module Paiements)
const router = Router();

const lecture = ['directeur', 'comptable', 'secretaire'];
const vente = ['directeur', 'comptable', 'secretaire'];
const gestion = ['directeur', 'comptable'];

router.use(authenticate, requireTenantMatch, requireModule('paiements'));

router.get('/articles', requireRole(...lecture), ctrl.listArticles);
router.post('/articles', requireRole(...gestion), ctrl.createArticle);
router.put('/articles/:id', requireRole(...gestion), idParamValidator, ctrl.updateArticle);
router.delete('/articles/:id', requireRole(...gestion), idParamValidator, ctrl.deleteArticle);

router.get('/', requireRole(...lecture), ctrl.listVentes);
router.post('/', requireRole(...vente), ctrl.createVente);
router.post('/:id/annuler', requireRole(...gestion), idParamValidator, ctrl.annulerVente);
router.get('/:id/recu-pdf', requireRole(...lecture), idParamValidator, ctrl.recuVentePdf);

export default router;
