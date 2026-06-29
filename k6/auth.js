import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, TENANT_SLUG } from './config.js';

export function login(email, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Slug': TENANT_SLUG,
      },
      tags: { type: 'auth' },
    }
  );

  check(res, {
    'login réussi (200)': r => r.status === 200,
    'cookie auth_token présent': r => r.cookies.auth_token !== undefined,
  });

  return res.cookies;
}
