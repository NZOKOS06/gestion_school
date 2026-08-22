#!/bin/sh
set -e

echo "[GestSchool] Migration base de données..."
npx prisma migrate deploy

# Jamais de seed automatique en production (comptes démo / mots de passe connus).
# Staging ou bootstrap unique : RUN_SEED=true
if [ "${RUN_SEED}" = "true" ]; then
  if [ "${NODE_ENV}" = "production" ] && [ "${ALLOW_PROD_SEED}" != "true" ]; then
    echo "[GestSchool] ERREUR: seed bloqué en production (définir ALLOW_PROD_SEED=true uniquement pour bootstrap contrôlé)."
    exit 1
  fi
  echo "[GestSchool] Seed demandé (RUN_SEED=true)..."
  node prisma/seed.js
else
  echo "[GestSchool] Seed ignoré (RUN_SEED non défini)."
fi

echo "[GestSchool] Vérification readiness prod..."
if [ "${SKIP_PROD_ASSERT}" = "true" ]; then
  echo "[GestSchool] assert-prod-ready ignoré (SKIP_PROD_ASSERT=true)"
else
  node scripts/assert-prod-ready.js
fi

echo "[GestSchool] Démarrage serveur Express..."
exec node src/index.js
