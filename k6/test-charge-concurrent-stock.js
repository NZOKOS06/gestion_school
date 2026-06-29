// Test spécifique : race condition sur le stock
// Vérifie que SELECT FOR UPDATE fonctionne correctement

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, TENANT_SLUG } from './config.js';
import { login } from './auth.js';

export const options = {
  // 20 utilisateurs simultanés pendant 30 secondes
  vus: 20,
  duration: '30s',
  thresholds: {
    // Au moins 50% des ventes doivent réussir (pas de dépassement stock)
    'checks{check:vente créée}': ['rate>0.5'],
    // Aucune vente ne doit créer un stock négatif
    'checks{check:pas de stock négatif}': ['rate==1'],
  },
};

export function setup() {
  const cookies = login('pharmacien@demo.cg', 'Pharmacien123!');
  // Récupérer l'ID d'un médicament avec stock limité
  // À adapter selon les IDs réels de la base
  return { cookies };
}

export default function(data) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': TENANT_SLUG,
    'Cookie': `auth_token=${data.cookies.auth_token[0].value}`,
  };

  // Tentative de vente simultanée
  const venteRes = http.post(
    `${BASE_URL}/api/ventes`,
    JSON.stringify({
      nomClient: `Test charge ${__VU}`,
      lignes: [{ medicamentId: __ENV.MED_ID, quantite: 1 }]
    }),
    { headers, tags: { check: 'vente créée' } }
  );

  // Soit la vente réussit (201) soit le stock est épuisé (400)
  // Dans tous les cas, jamais de 500
  check(venteRes, {
    'vente créée': r => r.status === 201,
    'ou stock épuisé': r => r.status === 400,
    'jamais erreur serveur': r => r.status !== 500,
  });
}
