@echo off
chcp 65001 >nul
title GestSchool — Lanceur Physique

echo.
echo  ██████╗ ███████╗███████╗████████╗███████╗ ██████╗██╗  ██╗ ██████╗  ██████╗ ██╗
echo ██╔════╝ ██╔════╝██╔════╝╚══██╔══╝██╔════╝██╔════╝██║  ██║██╔═══██╗██╔═══██╗██║
echo ██║  ███╗█████╗  ███████╗   ██║   ███████╗██║     ███████║██║   ██║██║   ██║██║
echo ██║   ██║██╔══╝  ╚════██║   ██║   ╚════██║██║     ██╔══██║██║   ██║██║   ██║██║
echo ╚██████╔╝███████╗███████║   ██║   ███████║╚██████╗██║  ██║╚██████╔╝╚██████╔╝███████╗
echo  ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚══════╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚══════╝
echo.
echo                    == MODE PHYSIQUE (Serveur Local d'Ecole) ==
echo.

:: ─── Vérifications préalables ─────────────────────────────────────────────────

echo [1/5] Verification de Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERREUR] Docker n'est pas installe ou n'est pas dans le PATH.
    echo  Telechargez Docker Desktop sur : https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)
echo       OK - Docker detecte.

echo [2/5] Verification que Docker est en cours d'execution...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERREUR] Docker Desktop n'est pas demarre.
    echo  Veuillez lancer Docker Desktop puis relancer ce script.
    echo.
    pause
    exit /b 1
)
echo       OK - Docker tourne.

:: ─── Créer le dossier backups si absent ────────────────────────────────────────
if not exist "backups" (
    mkdir backups
    echo [INFO] Dossier backups/ cree.
)

:: ─── Générer .env.local si absent ─────────────────────────────────────────────
if not exist ".env.local" (
    echo [3/5] Premiere installation detectee - Creation du fichier .env.local...
    (
        echo # GestSchool — Configuration Physique Locale
        echo # Generee automatiquement le %date% a %time%
        echo.
        echo # Mot de passe base de donnees
        echo DB_PASSWORD=GestSchool2025!
        echo.
        echo # Secrets JWT ^(CHANGEZ CES VALEURS en production^)
        echo JWT_SECRET=gestschool_jwt_secret_local_%RANDOM%%RANDOM%%RANDOM%
        echo JWT_REFRESH_SECRET=gestschool_refresh_secret_local_%RANDOM%%RANDOM%%RANDOM%
        echo.
        echo # URL d'acces ^(adapter si multi-poste sur reseau local^)
        echo FRONTEND_URL=http://localhost
        echo.
        echo # Port HTTP ^(80 par defaut^)
        echo HTTP_PORT=80
        echo.
        echo # Premier lancement : mettre true pour initialiser la base de donnees
        echo RUN_SEED=true
    ) > .env.local
    echo       OK - Fichier .env.local cree.
    echo.
    echo  IMPORTANT: Apres le premier lancement, remettez RUN_SEED=false dans .env.local
    echo.
) else (
    echo [3/5] Fichier .env.local existant detecte.
)

:: ─── Construction et démarrage ────────────────────────────────────────────────
echo [4/5] Construction et demarrage des services (peut prendre 2-5 min la 1ere fois)...
echo.
docker compose --env-file .env.local -f docker-compose.offline.yml up -d --build

if %errorlevel% neq 0 (
    echo.
    echo  [ERREUR] Le demarrage a echoue. Consultez les logs avec :
    echo  docker compose -f docker-compose.offline.yml logs
    echo.
    pause
    exit /b 1
)

:: ─── Attendre que le serveur soit prêt ────────────────────────────────────────
echo.
echo [5/5] Attente du demarrage complet des services...
set retries=0
:wait_loop
timeout /t 5 /nobreak >nul
docker exec gestschool-server-local wget -qO- http://127.0.0.1:3000/health >nul 2>&1
if %errorlevel% neq 0 (
    set /a retries+=1
    if %retries% lss 24 (
        echo       Attente... (%retries%/24^)
        goto wait_loop
    ) else (
        echo  [ATTENTION] Le serveur prend plus de temps que prevu.
        echo  Verifiez avec : docker compose -f docker-compose.offline.yml logs server
    )
) else (
    echo       OK - Tous les services sont operationnels !
)

:: ─── Afficher les infos d'accès ────────────────────────────────────────────────
echo.
echo ═══════════════════════════════════════════════════════════════════
echo   GestSchool est OPERATIONNEL
echo ═══════════════════════════════════════════════════════════════════
echo.

:: Obtenir l'IP locale
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "169.254"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

echo   Acces local     :  http://localhost
echo   Acces reseau    :  http://%LOCAL_IP%
echo   (Partagez cette URL avec les tablettes/PC du reseau local)
echo.
echo   Identifiants par defaut (si RUN_SEED=true) :
echo     Super Admin  : admin@gestschool.com  /  Admin1234!
echo.
echo ═══════════════════════════════════════════════════════════════════
echo.
echo   Commandes utiles :
echo     Arreter       : docker compose -f docker-compose.offline.yml down
echo     Voir les logs : docker compose -f docker-compose.offline.yml logs -f
echo     Sauvegarde    : docker exec gestschool-db-local pg_dump -U gestschool gestschool ^> backup.sql
echo.
echo ═══════════════════════════════════════════════════════════════════

:: Ouvrir le navigateur automatiquement
timeout /t 2 /nobreak >nul
start "" http://localhost

echo.
echo  Appuyez sur une touche pour fermer cette fenetre (GestSchool continue de tourner).
pause >nul
