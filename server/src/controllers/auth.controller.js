import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma, rawPrisma } from '../utils/prisma.js';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { captureError } from '../utils/sentry.js';
import { logAuditDirect } from '../utils/auditLogger.js';
import {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendPasswordChangedEmail,
  sendNewDeviceLoginEmail
} from '../services/email.service.js';
import { buildTenantUrl } from '../utils/tenantUrl.js';

const log = createLogger('AuthController');

const JWT_SECRET = config.jwtSecret;
const JWT_REFRESH_SECRET = config.jwtRefreshSecret;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const isProd = process.env.NODE_ENV === 'production';

const generateTokens = (userId, role, tenantId) => {
  const accessToken = jwt.sign(
    { userId, role, tenantId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { userId, role, tenantId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

export const login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    const tenantId = req.tenantId;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // 1. Chercher le staff par email dans le tenant courant (isolation multi-tenant)
    //    Si pas de tenant (domaine unique sans sous-domaine), chercher cross-tenant.
    //    Si plusieurs comptes avec le même email existent, on refuse pour éviter l'ambiguïté.
    let user = null;
    if (tenantId) {
      user = await rawPrisma.staff.findFirst({
        where: { email, tenantId },
        include: { tenant: { include: { config: true } } }
      });
    } else {
      const staffMatches = await rawPrisma.staff.findMany({
        where: { email },
        include: { tenant: { include: { config: true } } }
      });
      if (staffMatches.length === 1) {
        user = staffMatches[0];
      } else if (staffMatches.length > 1) {
        log.warn({ email, count: staffMatches.length }, 'Multiple staff accounts found for email without tenant');
        return res.status(400).json({
          error: 'Plusieurs comptes trouvés. Précisez l\'école (tenant).',
          tenants: staffMatches.map(s => ({ id: s.tenantId, slug: s.tenant.slug, nom: s.tenant.nom }))
        });
      }
      // Si length === 0, user reste null
    }

    // Si pas trouvé, essayer cross-tenant pour super_admin
    if (!user) {
      user = await rawPrisma.staff.findFirst({
        where: { email, role: 'super_admin' },
        include: { tenant: { include: { config: true } } }
      });
    }

    let role = null;
    let userType = null;

    if (user) {
      if (!user.actif) {
        return res.status(403).json({ error: 'Compte désactivé' });
      }
      // Vérifier que le tenant du staff est actif
      if (!user.tenant?.actif) {
        return res.status(403).json({ error: 'École désactivée' });
      }
      role = user.role;
      userType = 'staff';
    } else {
      // 2. Chercher le parent (user) dans le tenant courant, ou cross-tenant si pas de tenant
      let parentMatches = [];
      if (tenantId) {
        const parent = await prisma.user.findFirst({
          where: { email, tenantId },
          include: { tenant: { include: { config: true } } }
        });
        if (parent) parentMatches = [parent];
      } else {
        parentMatches = await prisma.user.findMany({
          where: { email },
          include: { tenant: { include: { config: true } } }
        });
        if (parentMatches.length > 1) {
          log.warn({ email, count: parentMatches.length }, 'Multiple parent accounts found for email without tenant');
          return res.status(400).json({
            error: 'Plusieurs comptes trouvés. Précisez l\'école (tenant).',
            tenants: parentMatches.map(c => ({ id: c.tenantId, slug: c.tenant.slug, nom: c.tenant.nom }))
          });
        }
      }

      user = parentMatches[0] || null;
      if (user) {
        if (!user.actif) {
          return res.status(403).json({ error: 'Compte désactivé' });
        }
        role = 'parent';
        userType = 'parent';
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, role, user.tenantId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt
      }
    });

    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || null;
    const userAgent = req.headers?.['user-agent'] || null;
    const now = new Date();

    if (userType === 'staff') {
      const isNewDevice =
        !user.lastIp ||
        !user.lastUserAgent ||
        user.lastIp !== ipAddress ||
        user.lastUserAgent !== userAgent;

      await rawPrisma.staff.update({
        where: { id: user.id },
        data: { derniereConnexion: now, lastIp: ipAddress, lastUserAgent: userAgent }
      });

      if (isNewDevice && user.email) {
        try {
          const nomApp = user.tenant?.config?.nomApp || user.tenant?.nom || 'GestSchool';
          await sendNewDeviceLoginEmail({
            to: user.email,
            nomApp,
            ipAddress,
            userAgent,
            loginAt: now
          });
        } catch (emailError) {
          log.error({ err: emailError, email: user.email }, 'Failed to send new device login email');
        }
      }
    } else if (userType === 'parent') {
      const isNewDevice =
        !user.lastIp ||
        !user.lastUserAgent ||
        user.lastIp !== ipAddress ||
        user.lastUserAgent !== userAgent;

      await prisma.user.update({
        where: { id: user.id },
        data: { derniereConnexion: now, lastIp: ipAddress, lastUserAgent: userAgent }
      });

      if (isNewDevice && user.email) {
        try {
          const nomApp = user.tenant?.config?.nomApp || user.tenant?.nom || 'GestSchool';
          await sendNewDeviceLoginEmail({
            to: user.email,
            nomApp,
            ipAddress,
            userAgent,
            loginAt: now
          });
        } catch (emailError) {
          log.error({ err: emailError, email: user.email }, 'Failed to send new device login email');
        }
      }
    }

    // Logger la connexion dans l'audit
    await logAuditDirect({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: role,
      action: 'login',
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
      userAgent: req.headers?.['user-agent'] || null,
      details: { email: user.email, name: `${user.prenom} ${user.nom}` }
    });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 15 * 60 * 60 * 1000,
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified || false,
        nom: user.nom,
        prenom: user.prenom,
        role: role,
        tenantId: user.tenantId,
        mustChangePassword: user.mustChangePassword || false,
        tenant: {
          nom: user.tenant.nom,
          slug: user.tenant.slug,
          config: user.tenant.config
        }
      },
      accessToken
    });
  } catch (error) {
    captureError(error, {
      tenantId,
      tenantSlug: req.tenant?.slug,
      action: 'login'
    });
    log.error({ err: error, email, tenantId }, 'Login error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req, res) => {
  try {
    const { email, password, nom, prenom, telephone, dateNaissance, adresse } = req.body;
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant requis pour l\'inscription.' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email, tenantId }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        nom,
        prenom,
        telephone,
        dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
        adresse
      },
      include: { tenant: { include: { config: true } } }
    });

    // Envoyer l'email de vérification
    try {
      const verificationToken = crypto.randomBytes(32).toString('hex');
      await rawPrisma.emailVerificationToken.create({
        data: {
          email,
          token: verificationToken,
          userType: 'parent',
          tenantId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      const nomApp = user.tenant?.config?.nomApp || user.tenant?.nom || 'GestSchool';
      const verificationUrl = buildTenantUrl(user.tenant, {
        path: '/verifier-email',
        queryParams: { token: verificationToken }
      });
      await sendEmailVerificationEmail({ to: email, verificationUrl, nomApp });
    } catch (emailError) {
      log.error({ err: emailError, email }, 'Failed to send registration verification email');
    }

    const { accessToken, refreshToken } = generateTokens(user.id, 'parent', tenantId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt
      }
    });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 15 * 60 * 60 * 1000,
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        nom: user.nom,
        prenom: user.prenom,
        role: 'parent',
        tenantId,
        tenant: {
          nom: user.tenant.nom,
          slug: user.tenant.slug,
          config: user.tenant.config
        }
      },
      accessToken
    });
  } catch (error) {
    log.error({ err: error, email, tenantId }, 'Register error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token manquant' });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
      return res.status(401).json({ error: 'Refresh token invalide' });
    }

    const accessToken = jwt.sign(
      { userId: decoded.userId, role: decoded.role, tenantId: decoded.tenantId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 15 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ accessToken });
  } catch (error) {
    captureError(error, {
      action: 'refreshToken'
    });
    log.error({ err: error }, 'Refresh token error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });
    }

    // Si on a un utilisateur authentifié, logger le logout
    if (req.user) {
      await logAuditDirect({
        tenantId: req.user.tenantId,
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'logout',
        ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
        userAgent: req.headers?.['user-agent'] || null
      });
    }

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });

    res.json({ message: 'Déconnecté avec succès' });
  } catch (error) {
    log.error({ err: error }, 'Logout error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    let userRecord;
    if (user.role === 'parent') {
      userRecord = await prisma.user.findUnique({ where: { id: user.id } });
    } else {
      userRecord = await prisma.staff.findUnique({ where: { id: user.id } });
    }

    if (!userRecord) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (!user.mustChangePassword) {
      const valid = await bcrypt.compare(currentPassword, userRecord.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      }
    }

    const isStrong = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword);
    if (!isStrong) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.'
      });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    let updatedUser;
    if (user.role === 'parent') {
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash }
      });
    } else {
      updatedUser = await prisma.staff.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          mustChangePassword: false
        }
      });
    }

    // Envoyer un email de confirmation de changement de mot de passe
    try {
      const nomApp = req.tenant?.config?.nomApp || req.tenant?.nom || 'GestSchool';
      await sendPasswordChangedEmail({
        to: updatedUser.email,
        nomApp,
        changedAt: new Date()
      });
    } catch (emailError) {
      log.error({ err: emailError, email: updatedUser.email }, 'Failed to send password changed email');
    }

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    log.error({ err: error, userId: user?.id }, 'Change password error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

const validatePasswordStrength = (password) => {
  return /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
};

export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const tenantId = req.tenantId;

    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    // Chercher l'utilisateur dans staff puis client
    let user = null;
    let userType = null;

    if (tenantId) {
      user = await rawPrisma.staff.findFirst({
        where: { email, tenantId },
        include: { tenant: { include: { config: true } } }
      });
    }

    if (!user) {
      user = await rawPrisma.staff.findFirst({
        where: { email, role: 'super_admin' },
        include: { tenant: { include: { config: true } } }
      });
    }

    if (user) {
      userType = 'staff';
    } else {
      user = await rawPrisma.user.findFirst({
        where: { email, tenantId },
        include: { tenant: { include: { config: true } } }
      });
      if (user) {
        userType = 'parent';
      }
    }

    // Réponse uniforme pour éviter l'énumération d'emails
    const successMessage = 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.';

    if (!user) {
      return res.json({ message: successMessage });
    }

    if (!user.actif) {
      return res.json({ message: successMessage });
    }

    // Invalider les anciens tokens non utilisés pour cet email
    await rawPrisma.passwordResetToken.updateMany({
      where: { email, userType, usedAt: null },
      data: { usedAt: new Date() }
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await rawPrisma.passwordResetToken.create({
      data: {
        email,
        token,
        userType,
        tenantId: user.tenantId,
        expiresAt
      }
    });

    const nomApp = user.tenant?.config?.nomApp || user.tenant?.nom || 'GestSchool';
    const resetUrl = buildTenantUrl(user.tenant, {
      path: '/reinitialiser-mot-de-passe',
      queryParams: { token }
    });

    try {
      await sendPasswordResetEmail({ to: email, resetUrl, nomApp });
    } catch (emailError) {
      log.error({ err: emailError, email }, 'Failed to send password reset email');
      // En dev, on continue pour permettre les tests
      if (config.nodeEnv !== 'development') {
        return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
      }
    }

    res.json({ message: successMessage });
  } catch (error) {
    captureError(error, {
      tenantId: req.tenantId,
      tenantSlug: req.tenant?.slug,
      action: 'forgotPassword'
    });
    log.error({ err: error }, 'Forgot password error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
    }

    if (!validatePasswordStrength(newPassword)) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.'
      });
    }

    const resetToken = await rawPrisma.passwordResetToken.findUnique({
      where: { token }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré' });
    }

    const { email, userType, tenantId } = resetToken;

    let user;
    if (userType === 'staff') {
      user = await rawPrisma.staff.findFirst({
        where: { email, tenantId },
        include: { tenant: { include: { config: true } } }
      });
    } else {
      user = await rawPrisma.user.findFirst({
        where: { email, tenantId },
        include: { tenant: { include: { config: true } } }
      });
    }

    if (!user || !user.actif) {
      return res.status(400).json({ error: 'Lien de réinitialisation invalide' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    if (userType === 'staff') {
      await rawPrisma.staff.update({
        where: { id: user.id },
        data: { passwordHash: newHash, mustChangePassword: false }
      });
    } else {
      await rawPrisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash }
      });
    }

    // Marquer le token comme utilisé et invalider les autres tokens actifs
    await rawPrisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    });
    await rawPrisma.passwordResetToken.updateMany({
      where: { email, userType, usedAt: null },
      data: { usedAt: new Date() }
    });

    await logAuditDirect({
      tenantId,
      actorId: user.id,
      actorRole: userType === 'staff' ? user.role : 'parent',
      action: 'password_changed',
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
      userAgent: req.headers?.['user-agent'] || null,
      details: { source: 'password_reset', email }
    });

    // Envoyer un email de confirmation de changement de mot de passe
    try {
      const nomApp = user.tenant?.config?.nomApp || user.tenant?.nom || 'GestSchool';
      await sendPasswordChangedEmail({
        to: email,
        nomApp,
        changedAt: new Date()
      });
    } catch (emailError) {
      log.error({ err: emailError, email }, 'Failed to send password changed email after reset');
    }

    res.json({ message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' });
  } catch (error) {
    captureError(error, {
      action: 'resetPassword'
    });
    log.error({ err: error }, 'Reset password error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requestEmailVerification = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const userType = user.role === 'parent' ? 'parent' : 'staff';
    let record;
    if (userType === 'parent') {
      record = await prisma.user.findUnique({ where: { id: user.id }, include: { tenant: { include: { config: true } } } });
    } else {
      record = await prisma.staff.findUnique({ where: { id: user.id }, include: { tenant: { include: { config: true } } } });
    }

    if (!record || !record.actif) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (record.emailVerified) {
      return res.json({ message: 'Email déjà vérifié', alreadyVerified: true });
    }

    // Invalider les anciens tokens
    await rawPrisma.emailVerificationToken.updateMany({
      where: { email: record.email, userType, usedAt: null },
      data: { usedAt: new Date() }
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

    await rawPrisma.emailVerificationToken.create({
      data: {
        email: record.email,
        token,
        userType,
        tenantId: record.tenantId,
        expiresAt
      }
    });

    const nomApp = record.tenant?.config?.nomApp || record.tenant?.nom || 'GestSchool';
    const verificationUrl = buildTenantUrl(record.tenant, {
      path: '/verifier-email',
      queryParams: { token }
    });

    try {
      await sendEmailVerificationEmail({ to: record.email, verificationUrl, nomApp });
    } catch (emailError) {
      log.error({ err: emailError, email: record.email }, 'Failed to send verification email');
      if (config.nodeEnv !== 'development') {
        return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
      }
    }

    res.json({ message: 'Email de vérification envoyé avec succès' });
  } catch (error) {
    captureError(error, {
      tenantId: req.tenantId,
      tenantSlug: req.tenant?.slug,
      action: 'requestEmailVerification'
    });
    log.error({ err: error }, 'Request email verification error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token requis' });
    }

    const verificationToken = await rawPrisma.emailVerificationToken.findUnique({
      where: { token }
    });

    if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Lien de vérification invalide ou expiré' });
    }

    const { email, userType, tenantId } = verificationToken;

    let user;
    if (userType === 'staff') {
      user = await rawPrisma.staff.findFirst({ where: { email, tenantId } });
    } else {
      user = await rawPrisma.user.findFirst({ where: { email, tenantId } });
    }

    if (!user || !user.actif) {
      return res.status(400).json({ error: 'Lien de vérification invalide' });
    }

    if (userType === 'staff') {
      await rawPrisma.staff.update({ where: { id: user.id }, data: { emailVerified: true } });
    } else {
      await rawPrisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }

    await rawPrisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() }
    });
    await rawPrisma.emailVerificationToken.updateMany({
      where: { email, userType, usedAt: null },
      data: { usedAt: new Date() }
    });

    await logAuditDirect({
      tenantId,
      actorId: user.id,
      actorRole: userType === 'staff' ? user.role : 'parent',
      action: 'email_verified',
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
      userAgent: req.headers?.['user-agent'] || null,
      details: { email }
    });

    res.json({ message: 'Email vérifié avec succès' });
  } catch (error) {
    captureError(error, { action: 'verifyEmail' });
    log.error({ err: error }, 'Verify email error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
