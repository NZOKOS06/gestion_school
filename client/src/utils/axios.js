import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MAX_RETRIES = 3;

export const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  // NE PAS forcer Content-Type ici :
  // Axios le définit automatiquement selon le type de data.
});

function getTenantSlug() {
  if (typeof window === 'undefined') {
    return null;
  }

  const pathname = window.location.pathname;

  // Le super-admin n'appartient pas à un tenant classique.
  if (pathname.startsWith('/super-admin')) {
    return null;
  }

  // Mode sous-domaine
  if (import.meta.env.VITE_SUBDOMAIN_MODE === 'true') {
    const host = window.location.hostname;
    const parts = host.split('.');

    if (parts.length >= 3) {
      const subdomain = parts[0];

      if (
        subdomain &&
        subdomain !== 'www' &&
        subdomain !== 'api'
      ) {
        return subdomain;
      }
    }
  }

  // Routes publiques : /e/:slug/... et /p/:slug/...
  const pathMatch = pathname.match(/^\/(?:e|p)\/([^/]+)/);

  if (pathMatch?.[1]) {
    const slug = pathMatch[1];

    localStorage.setItem('tenantSlug', slug);

    return slug;
  }

  // Paramètre URL : ?tenant=...
  const params = new URLSearchParams(window.location.search);
  const queryTenant = params.get('tenant');

  if (queryTenant) {
    localStorage.setItem('tenantSlug', queryTenant);

    return queryTenant;
  }

  // Tenant déjà mémorisé
  const storedTenant = localStorage.getItem('tenantSlug');

  if (storedTenant) {
    return storedTenant;
  }

  // Tenant par défaut
  return import.meta.env.VITE_DEFAULT_TENANT || 'demo';
}

axiosInstance.interceptors.request.use(
  (config) => {
    const tenantSlug = getTenantSlug();

    if (tenantSlug) {
      config.headers = config.headers || {};

      if (typeof config.headers.set === 'function') {
        config.headers.set('X-Tenant-Slug', tenantSlug);
      } else {
        config.headers['X-Tenant-Slug'] = tenantSlug;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

function shouldRetry(error) {
  if (!error.config || error.config.__retryCount >= MAX_RETRIES) {
    return false;
  }

  const method = (error.config.method || 'get').toLowerCase();

  // Ne jamais rejouer les uploads / mutations non-idempotentes
  // lorsqu'une réponse HTTP a déjà été reçue.
  if (
    method !== 'get' &&
    method !== 'head' &&
    error.response
  ) {
    return false;
  }

  // Réseau / timeout
  if (!error.response) {
    return true;
  }

  const status = error.response.status;

  return status >= 500 || status === 429;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    if (!config || !shouldRetry(error)) {
      return Promise.reject(error);
    }

    config.__retryCount = (config.__retryCount || 0) + 1;

    const delayMs = 300 * config.__retryCount;

    await new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });

    return axiosInstance.request(config);
  }
);

export default axiosInstance;

