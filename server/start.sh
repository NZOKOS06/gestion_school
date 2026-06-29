#!/bin/sh
set -e

echo "[GestPharma] Migration base de données..."
npx prisma migrate deploy

echo "[GestPharma] Seed données démo..."
node prisma/seed.js

echo "[GestPharma] Démarrage serveur Express..."
exec node src/index.js
