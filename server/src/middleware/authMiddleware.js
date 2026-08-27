import jwt from 'jsonwebtoken';
import { rawPrisma } from '../utils/prisma.js';
import { config } from '../config.js';
import { cacheGet, cacheSet, cacheDel, CacheKeys } from '../utils/cache.js';

const JWT_SECRET = config.jwtSecret;
const AUTH_CACHE_TTL = 60; // secondes — réduit les hits DB sans stale trop long

const MUST_CHANGE_ALLOWLIST = new Set([
  '/api/auth/change-password',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/refresh',
  '/api/staff/profile/me',
]);

const STAFF_AUTH_INCLUDE = {
  tenant: { include: { config: { include: { ipWhitelist: true } } } },
};

function normalizeIp(ip) {
  let value = String(ip || '').trim();
  if (value.startsWith('::ffff:')) value = value.slice(7);
  if (value === '::1') value = '127.0.0.1';
  return value;
}

function clientIp(req) {
  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
}

function isStaffIpAllowed(user, req) {
  const list = user.ipWhitelist;
  if (!Array.isArray(list) || list.length === 0) return true;
  const ip = clientIp(req);
  return list.map(normalizeIp).includes(ip);
}

function ipListFromStaff(staff) {
  return staff?.tenant?.config?.ipWhitelist?.map((row) => row.ip) || [];
}

export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken ||
                  req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Veuillez vous connecter.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    let user = null;

    if (decoded.role === 'super_admin') {
      const staff = await rawPrisma.staff.findUnique({
        where: { id: decoded.userId },
        include: { tenant: { include: { config: true } } },
      });
      if (!staff || !staff.actif || staff.role !== 'super_admin') {
        return res.status(401).json({
          error: 'User not found or inactive',
        });
      }
      user = {
        id: staff.id,
        role: 'super_admin',
        tenantId: staff.tenantId || null,
        email: staff.email,
        nom: staff.nom,
        prenom: staff.prenom,
        mustChangePassword: staff.mustChangePassword,
      };
    } else if (decoded.role === 'parent') {
      const cacheKey = CacheKeys.authUser('parent', decoded.userId);
      user = await cacheGet(cacheKey);
      if (!user) {
        const parent = await rawPrisma.user.findUnique({
          where: { id: decoded.userId },
          include: { tenant: { include: { config: true } } }
        });

        if (!parent || !parent.actif) {
          return res.status(401).json({
            error: 'User not found or inactive'
          });
        }

        user = {
          id: parent.id,
          role: 'parent',
          tenantId: parent.tenantId,
          tenant: parent.tenant,
          email: parent.email,
          nom: parent.nom,
          prenom: parent.prenom
        };
        await cacheSet(cacheKey, user, AUTH_CACHE_TTL);
      }
    } else {
      const cacheKey = CacheKeys.authUser(decoded.role || 'staff', decoded.userId);
      user = await cacheGet(cacheKey);
      if (!user) {
        const staff = await rawPrisma.staff.findUnique({
          where: { id: decoded.userId },
          include: STAFF_AUTH_INCLUDE,
        });

        if (!staff || !staff.actif) {
          return res.status(401).json({
            error: 'Staff not found or inactive'
          });
        }

        user = {
          id: staff.id,
          role: staff.role,
          tenantId: staff.tenantId,
          tenant: staff.tenant,
          email: staff.email,
          nom: staff.nom,
          prenom: staff.prenom,
          mustChangePassword: staff.mustChangePassword,
          ipWhitelist: ipListFromStaff(staff),
        };
        await cacheSet(CacheKeys.authUser(staff.role, staff.id), user, AUTH_CACHE_TTL);
      }
    }

    req.user = user;

    if (user.role !== 'parent' && user.role !== 'super_admin') {
      if (!Array.isArray(user.ipWhitelist) && user.tenantId) {
        const rows = await rawPrisma.tenantIpWhitelist.findMany({
          where: { tenantId: user.tenantId },
          select: { ip: true },
        });
        user.ipWhitelist = rows.map((row) => row.ip);
      }
      if (!isStaffIpAllowed(user, req)) {
        return res.status(403).json({
          error: 'IP not allowed',
          message: 'Accès interdit depuis cette adresse IP.',
        });
      }
    }

    if (user.mustChangePassword) {
      const path = (req.originalUrl || req.path || '').split('?')[0];
      if (!MUST_CHANGE_ALLOWLIST.has(path)) {
        return res.status(403).json({
          error: 'Password change required',
          code: 'MUST_CHANGE_PASSWORD',
          message: 'Vous devez changer votre mot de passe avant de continuer.',
        });
      }
    }

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Invalide le cache profil après changement de rôle / désactivation. */
export async function invalidateAuthCache(role, userId) {
  if (!userId) return;
  await cacheDel(CacheKeys.authUser(role || 'staff', userId));
}

/**
 * Contrôle d'accès serveur — à utiliser sur toutes les routes sensibles.
 * Le front (ProtectedRoute) n'est qu'une UX ; la sécurité est ici.
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Vous n\'avez pas les droits nécessaires.'
      });
    }

    next();
  };
};

export const requireTenantMatch = (req, res, next) => {
  if (req.user.role === 'super_admin') {
    return next();
  }

  if (!req.tenantId || req.user.tenantId !== req.tenantId) {
    return res.status(403).json({
      error: 'Tenant mismatch',
      message: 'Accès interdit : tenant mismatch.'
    });
  }

  next();
};
