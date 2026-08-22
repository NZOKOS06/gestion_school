import jwt from 'jsonwebtoken';
import { rawPrisma } from '../utils/prisma.js';
import { config } from '../config.js';
import { cacheGet, cacheSet, cacheDel, CacheKeys } from '../utils/cache.js';

const JWT_SECRET = config.jwtSecret;
const AUTH_CACHE_TTL = 60; // secondes — réduit les hits DB sans stale trop long

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
      user = {
        id: decoded.userId,
        role: 'super_admin',
        tenantId: decoded.tenantId || null
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
          include: { tenant: { include: { config: true } } }
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
          mustChangePassword: staff.mustChangePassword
        };
        await cacheSet(CacheKeys.authUser(staff.role, staff.id), user, AUTH_CACHE_TTL);
      }
    }

    req.user = user;
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
