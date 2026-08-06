/**
 * Smoke k6 — login directeur GestSchool
 * Usage: k6 run k6/smoke-auth.js
 */
import { check, sleep } from 'k6';
import { login } from './auth.js';
import { DIRECTEUR_EMAIL, DIRECTEUR_PASSWORD } from './config.js';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    checks: ['rate>0.9'],
  },
};

export default function () {
  const cookies = login(DIRECTEUR_EMAIL, DIRECTEUR_PASSWORD);
  check(cookies, {
    'session établie': (c) => c && (c.auth_token || c['auth_token']),
  });
  sleep(1);
}
