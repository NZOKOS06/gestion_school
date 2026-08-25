#!/bin/sh
set -e

echo "[GestSchool] Migration base de données..."
# Si une migration a échoué (ex. BOM UTF-8), la marquer rolled-back puis réappliquer
npx prisma migrate resolve --rolled-back "20260825120000_periode_concerne_cycles" >/dev/null 2>&1 || true
npx prisma migrate deploy

echo "[GestSchool] Sync super-admin (email/mot de passe Render)..."
node scripts/sync-super-admin.js

# Jamais de seed automatique si des données existent déjà.
# - RUN_SEED=true + ALLOW_PROD_SEED=true : force un seed (bootstrap contrôlé)
# - sinon : seed uniquement si la base est vide
if [ "${RUN_SEED}" = "true" ]; then
  if [ "${NODE_ENV}" = "production" ] && [ "${ALLOW_PROD_SEED}" != "true" ]; then
    echo "[GestSchool] ERREUR: seed bloqué en production (définir ALLOW_PROD_SEED=true uniquement pour bootstrap contrôlé)."
    exit 1
  fi
  echo "[GestSchool] Seed forcé (RUN_SEED=true)..."
  node prisma/seed.js
else
  echo "[GestSchool] Bootstrap si base vide..."
  node scripts/bootstrap-if-empty.js
fi

echo "[GestSchool] Vérification readiness prod..."
if [ "${SKIP_PROD_ASSERT}" = "true" ]; then
  echo "[GestSchool] assert-prod-ready ignoré (SKIP_PROD_ASSERT=true)"
else
  node scripts/assert-prod-ready.js
fi

echo "[GestSchool] Démarrage serveur Express..."
exec node src/index.js
