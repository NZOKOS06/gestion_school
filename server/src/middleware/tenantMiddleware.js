import { prisma, asyncLocalStorage } from '../utils/prisma.js';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const SUBDOMAIN_MODE = process.env.SUBDOMAIN_MODE === 'true';

// Résolution du tenant (partagé entre tenantMiddleware et optionalTenantMiddleware)
const resolveTenant = async (req) => {
  let slug = null;
  let tenant = null;

  // a) Sous-domaine (SUBDOMAIN_MODE=true)
  if (SUBDOMAIN_MODE) {
    const host = req.headers.host || '';
    const parts = host.split('.');
    if (parts.length >= 3 && !host.includes('localhost')) {
      slug = parts[0];
    }
  }

  // b) URL /e/:slug ou /p/:slug (legacy)
  if (!slug && (req.path.startsWith('/e/') || req.path.startsWith('/p/') || req.originalUrl?.includes('/e/') || req.originalUrl?.includes('/p/'))) {
    const match = (req.originalUrl || req.path).match(/\/(?:e|p)\/([^\/\?]+)/);
    if (match) slug = match[1];
  }

  // c) Query ?tenant=slug
  if (!slug && req.query.tenant) {
    slug = req.query.tenant;
  }

  // d) Header X-Tenant-Slug
  if (!slug && req.headers['x-tenant-slug']) {
    slug = req.headers['x-tenant-slug'];
  }

  // e) Fallback : JWT token (pour les routes authentifiées du super_admin)
  if (!slug) {
    const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        if (decoded.tenantId) {
          tenant = await prisma.tenant.findUnique({
            where: { id: decoded.tenantId },
            include: { config: true }
          });
        }
      } catch {
        // Token invalide ou expiré — continuer vers le fallback
      }
    }
  }

  // f) Fallback "demo" — uniquement en développement
  if (!slug && !tenant) {
    if (process.env.NODE_ENV === 'production') {
      return { tenant: null, error: { status: 400, error: 'Tenant required', message: 'Identifiant d\'école requis. Spécifiez un slug via le header X-Tenant-Slug, un sous-domaine ou un paramètre URL.' } };
    }
    slug = 'demo';
  }

  // Recherche du tenant en base (si pas déjà trouvé via JWT)
  if (!tenant && slug) {
    tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: { config: true }
    });

    if (!tenant) {
      return { tenant: null, error: { status: 404, error: 'Tenant not found', message: `L'école "${slug}" n'existe pas ou n'est pas active.` } };
    }

    if (!tenant.actif) {
      return { tenant: null, error: { status: 403, error: 'Tenant inactive', message: 'Cette école est temporairement désactivée.' } };
    }
  }

  return { tenant };
};

// Middleware strict : bloque si aucun tenant trouvé
export const tenantMiddleware = async (req, res, next) => {
  try {
    const { tenant, error } = await resolveTenant(req);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }
    if (!tenant) {
      return res.status(400).json({ error: 'Tenant required', message: 'Impossible de résoudre le tenant.' });
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    asyncLocalStorage.run({ tenantId: tenant.id }, () => next());
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware optionnel : ne bloque pas si aucun tenant trouvé (ex: auth routes pour super_admin)
export const optionalTenantMiddleware = async (req, res, next) => {
  try {
    const { tenant, error } = await resolveTenant(req);
    // En mode optionnel, on ignore les erreurs et on continue sans tenant
    if (tenant) {
      req.tenant = tenant;
      req.tenantId = tenant.id;
      return asyncLocalStorage.run({ tenantId: tenant.id }, () => next());
    }
    // Pas de tenant — continuer sans (req.tenant et req.tenantId restent undefined)
    next();
  } catch (error) {
    console.error('Optional tenant middleware error:', error);
    next();
  }
};

const MODULE_KEY_ALIASES = {
  absences: 'modulePresences',
  presences: 'modulePresences',
  emploiDuTemps: 'moduleEmploiDuTemps',
};

export const requireModule = (moduleName) => {
  return (req, res, next) => {
    const config = req.tenant?.config;
    
    if (!config) {
      return res.status(403).json({
        error: 'Configuration not found',
        message: 'Configuration du tenant introuvable.'
      });
    }

    const moduleKey = MODULE_KEY_ALIASES[moduleName]
      || `module${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`;

    // Modules without a schema flag (e.g. actualites) stay enabled by default
    if (!(moduleKey in config)) {
      return next();
    }

    if (!config[moduleKey]) {
      return res.status(403).json({
        error: 'Module disabled',
        message: `Le module "${moduleName}" n'est pas activé pour cette école.`
      });
    }

    next();
  };
};
