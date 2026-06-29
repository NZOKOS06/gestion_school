import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { BASE_URL, TENANT_SLUG, THRESHOLDS } from './config.js';
import { login } from './auth.js';

// Scénarios de charge
export const options = {
  thresholds: THRESHOLDS,
  scenarios: {
    // Scénario 1 — Charge normale (journée type)
    charge_normale: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },  // montée progressive
        { duration: '1m',  target: 10 }, // charge normale
        { duration: '30s', target: 0 },  // descente
      ],
      tags: { scenario: 'normale' },
    },

    // Scénario 2 — Pic de charge (heure de pointe)
    pic_charge: {
      executor: 'ramping-vus',
      startTime: '2m',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 30 }, // pic soudain
        { duration: '30s', target: 30 }, // maintien
        { duration: '15s', target: 0 },  // retour normal
      ],
      tags: { scenario: 'pic' },
    },

    // Scénario 3 — Test soak (endurance 5 minutes)
    endurance: {
      executor: 'constant-vus',
      startTime: '3m',
      vus: 5,
      duration: '5m',
      tags: { scenario: 'endurance' },
    },
  },
};

// Données de test partagées
const medicaments = new SharedArray('medicaments', function() {
  // IDs à remplacer par de vrais IDs de la base demo
  return [
    { id: 'med-paracetamol-id', nom: 'Paracétamol' },
    { id: 'med-ibuprofene-id',  nom: 'Ibuprofène'  },
  ];
});

export function setup() {
  // Login une fois, partager les cookies
  const cookies = login(
    __ENV.PHARMACIEN_EMAIL || 'pharmacien@demo.cg',
    __ENV.PHARMACIEN_PASSWORD || 'Pharmacien123!'
  );
  return { cookies };
}

export default function(data) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': TENANT_SLUG,
    'Cookie': `auth_token=${data.cookies.auth_token[0].value}`,
  };

  // TEST 1 — Consultation catalogue (lecture)
  const catalogueRes = http.get(
    `${BASE_URL}/api/medicaments?page=1&limit=20`,
    { headers, tags: { endpoint: 'catalogue' } }
  );
  check(catalogueRes, {
    'catalogue: status 200': r => r.status === 200,
    'catalogue: < 200ms': r => r.timings.duration < 200,
  });

  sleep(0.5);

  // TEST 2 — Dashboard KPIs (agrégation)
  const dashRes = http.get(
    `${BASE_URL}/api/dashboard/kpis`,
    { headers, tags: { endpoint: 'dashboard' } }
  );
  check(dashRes, {
    'dashboard: status 200': r => r.status === 200,
    'dashboard: < 500ms': r => r.timings.duration < 500,
  });

  sleep(0.5);

  // TEST 3 — Alertes stock
  const alertesRes = http.get(
    `${BASE_URL}/api/stock/alertes`,
    { headers, tags: { endpoint: 'alertes' } }
  );
  check(alertesRes, {
    'alertes: status 200': r => r.status === 200,
  });

  sleep(1);
}

export function teardown(data) {
  // Logout
  http.post(`${BASE_URL}/api/auth/logout`, null, {
    headers: {
      'Cookie': `auth_token=${data.cookies.auth_token[0].value}`,
      'X-Tenant-Slug': TENANT_SLUG,
    }
  });
}
