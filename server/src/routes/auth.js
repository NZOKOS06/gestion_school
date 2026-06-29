import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { loginValidator, forgotPasswordValidator, registerValidator } from '../utils/validators.js';
import * as ctrl from '../controllers/auth.controller.js';

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion staff ou parent
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantSlug'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: directeur@demo.cg
 *               password:
 *                 type: string
 *                 example: Directeur123!
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         headers:
 *           Set-Cookie:
 *             description: auth_token + refresh_token (HttpOnly)
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     nom: { type: string }
 *                     prenom: { type: string }
 *                     role: { type: string }
 *                     mustChangePassword: { type: boolean }
 *       401:
 *         description: Identifiants incorrects
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Trop de tentatives (rate limit 10/15min)
 */
// POST /api/auth/login
router.post('/login', loginValidator, ctrl.login);

// POST /api/auth/register (parent uniquement)
router.post('/register', registerValidator, ctrl.register);

// POST /api/auth/refresh
router.post('/refresh', ctrl.refresh);

// POST /api/auth/logout
router.post('/logout', ctrl.logout);

// POST /api/auth/change-password
router.post('/change-password', authenticate, ctrl.changePassword);

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordValidator, ctrl.forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', ctrl.resetPassword);

// POST /api/auth/request-email-verification
router.post('/request-email-verification', authenticate, ctrl.requestEmailVerification);

// POST /api/auth/verify-email
router.post('/verify-email', ctrl.verifyEmail);

export default router;
