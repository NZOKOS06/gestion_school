import { config } from '../config.js';

/**
 * Construit l'URL publique d'un tenant à partir de son slug et de son domaine personnalisé.
 * Utilise le domaine personnalisé si configuré, sinon le FRONTEND_URL configuré avec le slug.
 */
export const buildTenantUrl = (tenant, options = {}) => {
  const { path = '', queryParams = {} } = options;

  if (!tenant) {
    return config.frontendUrl;
  }

  const baseUrl = tenant.domainePersonnalise
    ? `https://${tenant.domainePersonnalise}`
    : config.frontendUrl;

  // Nettoyer le slash final
  const cleanBase = baseUrl.replace(/\/$/, '');

  // Construire le chemin
  let fullPath = path;
  if (!fullPath.startsWith('/')) {
    fullPath = '/' + fullPath;
  }

  const url = new URL(`${fullPath}`, cleanBase);

  // Si un domaine personnalisé est configuré, on ne met pas le slug
  // Sinon, le frontend résout le tenant via le paramètre ?tenant=slug
  if (tenant.slug && !tenant.domainePersonnalise) {
    url.searchParams.set('tenant', tenant.slug);
  }

  // Ajouter les query params supplémentaires
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
};

export default { buildTenantUrl };
