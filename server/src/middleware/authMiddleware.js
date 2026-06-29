import jwt from 'jsonwebtoken';
import { rawPrisma } from '../utils/prisma.js';
import { config } from '../config.js';

const JWT_SECRET = config.jwtSecret;

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
    
    // Vérification du rôle et récupération des données utilisateur
    let user = null;
    
    if (decoded.role === 'super_admin') {
      // Super admin — utilise le tenantId du JWT (tenant système)
      user = {
        id: decoded.userId,
        role: 'super_admin',
        tenantId: decoded.tenantId || null
      };
    } else if (decoded.role === 'parent') {
      // Parent (équivalent client)
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
    } else {
      // Staff (directeur, secretaire, enseignant, etc.)
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
