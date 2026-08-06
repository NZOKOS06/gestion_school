/**
 * Config k6 — GestSchool
 * Exemple : k6 run k6/smoke-auth.js
 */
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const TENANT_SLUG = __ENV.TENANT_SLUG || 'demo';

export const DIRECTEUR_EMAIL = __ENV.DIRECTEUR_EMAIL || 'directeur@demo.cg';
export const DIRECTEUR_PASSWORD = __ENV.DIRECTEUR_PASSWORD || 'Directeur123!';
