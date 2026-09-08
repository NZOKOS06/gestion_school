#!/bin/bash
# ============================================================
# GestSchool — Lanceur Physique Linux / Raspberry Pi / Ubuntu
# ============================================================
# Usage : chmod +x lancer-gestschool-linux.sh && ./lancer-gestschool-linux.sh
# ============================================================

set -e

# Couleurs terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

COMPOSE_FILE="docker-compose.offline.yml"
ENV_FILE=".env.local"

clear
echo -e "${CYAN}${BOLD}"
echo "  ██████╗ ███████╗███████╗████████╗███████╗ ██████╗██╗  ██╗ ██████╗  ██████╗ ██╗"
echo " ██╔════╝ ██╔════╝██╔════╝╚══██╔══╝██╔════╝██╔════╝██║  ██║██╔═══██╗██╔═══██╗██║"
echo " ██║  ███╗█████╗  ███████╗   ██║   ███████╗██║     ███████║██║   ██║██║   ██║██║"
echo " ██║   ██║██╔══╝  ╚════██║   ██║   ╚════██║██║     ██╔══██║██║   ██║██║   ██║██║"
echo " ╚██████╔╝███████╗███████║   ██║   ███████║╚██████╗██║  ██║╚██████╔╝╚██████╔╝███████╗"
echo "  ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚══════╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚══════╝"
echo -e "${NC}"
echo -e "${BOLD}               == MODE PHYSIQUE — Serveur Local d'École ==${NC}"
echo ""

# ─── Vérification Docker ──────────────────────────────────────────────────────
echo -e "${BLUE}[1/5]${NC} Vérification de Docker..."
if ! command -v docker &>/dev/null; then
    echo -e "${RED}[ERREUR]${NC} Docker n'est pas installé."
    echo ""
    echo "  Installation automatique (Ubuntu/Debian) :"
    echo "    curl -fsSL https://get.docker.com | sh"
    echo "    sudo usermod -aG docker \$USER && newgrp docker"
    echo ""
    exit 1
fi
echo -e "      ${GREEN}OK${NC} — Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# ─── Vérification Docker Compose ──────────────────────────────────────────────
if ! docker compose version &>/dev/null; then
    echo -e "${RED}[ERREUR]${NC} Docker Compose v2 requis. Installez Docker Desktop ou le plugin compose."
    exit 1
fi

# ─── Vérification que Docker tourne ──────────────────────────────────────────
echo -e "${BLUE}[2/5]${NC} Vérification que Docker est actif..."
if ! docker info &>/dev/null; then
    echo -e "${RED}[ERREUR]${NC} Le daemon Docker ne tourne pas."
    echo "  Lancez-le avec : sudo systemctl start docker"
    exit 1
fi
echo -e "      ${GREEN}OK${NC} — Daemon Docker actif."

# ─── Créer le dossier backups ──────────────────────────────────────────────────
mkdir -p backups

# ─── Générer .env.local si absent ─────────────────────────────────────────────
echo -e "${BLUE}[3/5]${NC} Configuration de l'environnement..."
if [ ! -f "$ENV_FILE" ]; then
    echo "      Première installation détectée — création de $ENV_FILE..."
    RAND1=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)
    RAND2=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)
    cat > "$ENV_FILE" <<EOF
# GestSchool — Configuration Physique Locale
# Générée automatiquement le $(date)

# Mot de passe base de données
DB_PASSWORD=GestSchool2025!

# Secrets JWT (CHANGEZ ces valeurs pour la sécurité)
JWT_SECRET=${RAND1}
JWT_REFRESH_SECRET=${RAND2}

# URL d'accès (adapter si multi-poste sur réseau local)
FRONTEND_URL=http://localhost

# Port HTTP (80 par défaut — nécessite sudo si < 1024)
HTTP_PORT=80

# Premier lancement : mettre true pour initialiser la base de données
RUN_SEED=true
EOF
    echo -e "      ${GREEN}OK${NC} — $ENV_FILE créé avec des secrets aléatoires."
    echo -e "      ${YELLOW}IMPORTANT${NC}: Après le 1er lancement, mettez RUN_SEED=false dans $ENV_FILE"
else
    echo -e "      ${GREEN}OK${NC} — $ENV_FILE existant détecté."
fi

# ─── Port 80 : vérifier les permissions ──────────────────────────────────────
HTTP_PORT=$(grep HTTP_PORT "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "80")
if [ "$HTTP_PORT" -lt 1024 ] 2>/dev/null && [ "$(id -u)" -ne 0 ]; then
    echo -e "      ${YELLOW}[ATTENTION]${NC} Port $HTTP_PORT < 1024 — exécution en tant que root recommandée."
    echo "      Relancez avec : sudo ./lancer-gestschool-linux.sh"
fi

# ─── Build et démarrage ────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[4/5]${NC} Construction et démarrage des services..."
echo -e "      (Peut prendre ${YELLOW}3-10 minutes${NC} lors du premier lancement)"
echo ""

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

echo ""
echo -e "${BLUE}[5/5]${NC} Attente du démarrage complet..."
RETRIES=0
MAX_RETRIES=30
while [ $RETRIES -lt $MAX_RETRIES ]; do
    if docker exec gestschool-server-local wget -qO- http://127.0.0.1:3000/health &>/dev/null; then
        break
    fi
    RETRIES=$((RETRIES + 1))
    echo -ne "      Tentative $RETRIES/$MAX_RETRIES...\r"
    sleep 5
done

if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo -e "${YELLOW}[ATTENTION]${NC} Le serveur prend plus de temps que prévu."
    echo "  Vérifiez : docker compose -f $COMPOSE_FILE logs server"
else
    echo -e "      ${GREEN}OK${NC} — Tous les services sont opérationnels !"
fi

# ─── Afficher l'IP locale ─────────────────────────────────────────────────────
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1 | awk '{print $7}' | head -1)

echo ""
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  GestSchool est OPÉRATIONNEL ✓${NC}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Accès local     :${NC}  http://localhost"
echo -e "  ${BOLD}Accès réseau LAN:${NC}  ${GREEN}http://${LOCAL_IP}${NC}"
echo ""
echo -e "  Partagez ${GREEN}http://${LOCAL_IP}${NC} avec les tablettes/PC du réseau Wi-Fi de l'école"
echo ""
echo -e "  ${BOLD}Identifiants par défaut (si RUN_SEED=true) :${NC}"
echo -e "    Super Admin  : admin@gestschool.com  /  Admin1234!"
echo ""
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Commandes utiles :${NC}"
echo -e "    Arrêter       : ${YELLOW}docker compose -f $COMPOSE_FILE down${NC}"
echo -e "    Voir les logs : ${YELLOW}docker compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "    Sauvegarde    : ${YELLOW}docker exec gestschool-db-local pg_dump -U gestschool gestschool > backup_\$(date +%Y%m%d).sql${NC}"
echo ""
echo -e "  ${BOLD}Démarrage auto au boot (Linux) :${NC}"
echo -e "    ${YELLOW}sudo crontab -e${NC}  puis ajouter :"
echo -e "    ${YELLOW}@reboot cd $(pwd) && docker compose -f $COMPOSE_FILE up -d${NC}"
echo ""
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"

# Ouvrir le navigateur si possible
if command -v xdg-open &>/dev/null; then
    sleep 2 && xdg-open "http://localhost" &
elif command -v open &>/dev/null; then
    sleep 2 && open "http://localhost" &
fi
