#!/usr/bin/env bash
# Déployé sur le serveur distant via GitHub Actions (secrets DEPLOY_*).
# Usage local: DEPLOY_PATH=/opt/gestschool ./scripts/deploy-remote.sh <git-sha>
set -euo pipefail

SHA="${1:-}"
APP_DIR="${DEPLOY_PATH:-/opt/gestschool}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

cd "$APP_DIR"

echo "[deploy] Répertoire: $APP_DIR"
git fetch --all --prune
if [ -n "$SHA" ]; then
  git checkout --force "$SHA"
else
  git checkout --force main
  git pull --ff-only origin main
fi

echo "[deploy] Build + restart containers..."
docker compose -f "$COMPOSE_FILE" pull || true
docker compose -f "$COMPOSE_FILE" up -d --build

echo "[deploy] Attente healthcheck ($HEALTH_URL)..."
ok=0
for i in $(seq 1 30); do
  if curl -sf "$HEALTH_URL" >/dev/null; then
    ok=1
    break
  fi
  sleep 2
done

if [ "$ok" != "1" ]; then
  echo "[deploy] ÉCHEC healthcheck — logs serveur:"
  docker compose -f "$COMPOSE_FILE" logs --tail=80 server || true
  exit 1
fi

echo "[deploy] OK — $(curl -sf "$HEALTH_URL" || true)"
