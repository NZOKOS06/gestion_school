// Configuration partagée entre les tests
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const TENANT_SLUG = __ENV.TENANT_SLUG || 'demo';
export const PHARMACIEN_EMAIL = __ENV.PHARMACIEN_EMAIL || 'pharmacien@demo.cg';
export const PHARMACIEN_PASSWORD = __ENV.PHARMACIEN_PASSWORD || 'Pharmacien123!';

// Seuils de performance acceptables
export const THRESHOLDS = {
  // 95% des requêtes en moins de 500ms
  http_req_duration: ['p(95)<500'],
  // 99% en moins de 1s
  'http_req_duration{type:auth}': ['p(99)<1000'],
  // Moins de 1% d'erreurs
  http_req_failed: ['rate<0.01'],
};
