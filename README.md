# GestPharma V1

> Progiciel SaaS multi-tenant de gestion de pharmacies
> Marché cible : Congo-Brazzaville et Afrique francophone

---

## Stack technique

| Couche | Technologies |
|--------|-------------|
| Backend | Node.js 20, Express 4, Prisma 5, PostgreSQL 16 |
| Frontend | React 19, Vite 6, Tailwind CSS 3.4, React Router 7 |
| Temps réel | Socket.IO 4 |
| Auth | JWT dual-token (cookies HttpOnly + refresh rotation) |
| Tests | Vitest (unitaire + intégration) + Playwright (E2E) |
| Infra | Docker Compose, Nginx |

---

## Fonctionnalités principales

- **Multi-tenant** : chaque pharmacie a son espace isolé
- **White-label** : couleurs, logo, police configurables par tenant
- **13 modules SaaS** activables/désactivables par pharmacie
- **Stock FEFO** : traçabilité par lot, alertes péremption automatiques
- **Circuit médicament complet** : commande fournisseur → réception → vente → encaissement
- **Gestion ordonnances** : upload, validation pharmacien, dispensation
- **Temps réel** : notifications stock, ordonnances, livraisons via Socket.IO
- **PWA** : fonctionne hors-ligne (coupures réseau fréquentes en Afrique)

---

## Documentation API

La documentation interactive de l'API est disponible sur **http://localhost:3000/api/docs** (Swagger UI).

Cette documentation permet de :
- Explorer tous les endpoints REST
- Tester les requêtes directement depuis l'interface
- Voir les schémas de requête/réponse
- Télécharger la spec OpenAPI JSON via `/api/docs.json`

**Note** : Pour les endpoints protégés, connectez-vous d'abord via `POST /api/auth/login` pour obtenir les cookies d'authentification.

---

## Démarrage rapide

### Prérequis
- Node.js 20+
- PostgreSQL 16+ (ou Docker)
- npm 10+

### Option 1 — Docker (recommandé)

```bash
git clone https://github.com/[username]/gestpharma.git
cd gestpharma
cp server/.env.example server/.env
# Éditer server/.env avec vos valeurs
docker-compose up -d
```

L'app sera disponible sur :
- Frontend : http://localhost:5173
- API : http://localhost:3001

### Option 2 — Installation manuelle

```bash
# 1. Backend
cd server
cp .env.example .env
# Éditer .env avec DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npm install
npx prisma migrate dev
npm run db:seed
npm run dev

# 2. Frontend (nouveau terminal)
cd client
cp .env.example .env
npm install
npm run dev
```

---

## Comptes de démonstration

| Rôle | Email | Mot de passe | Accès |
|------|-------|--------------|-------|
| Super Admin | superadmin@gestpharma.com | SuperAdmin123! | /super-admin |
| Pharmacien | pharmacien@demo.cg | Pharmacien123! | /admin/dashboard |

URL de la pharmacie démo : http://localhost:5173/p/demo

---

## Architecture multi-tenant

Chaque pharmacie accède à son espace via :
- **Sous-domaine** (production) : `pharmacie.gestpharma.com` 
- **URL** (développement) : `localhost:5173/p/demo` 

L'isolation des données est garantie par :
1. `tenantMiddleware` — résout le slug depuis l'URL/sous-domaine/header
2. `AsyncLocalStorage` — propage le tenantId dans tout le contexte async
3. `extendedPrisma` — injecte automatiquement `{ where: { tenantId } }` 
   sur toutes les requêtes Prisma

---

## Modules disponibles (13)

| Module | Défaut | Description |
|--------|--------|-------------|
| Catalogue | ✅ ON | Catalogue médicaments (verrouillé) |
| Stock | ✅ ON | Gestion stocks et lots FEFO |
| Ventes | ✅ ON | Ventes et encaissement |
| Ordonnances | ✅ ON | Ordonnances et prescriptions |
| Fournisseurs | ✅ ON | Commandes fournisseurs |
| Personnel | ✅ ON | Gestion du staff |
| Rapports | ✅ ON | Statistiques et exports |
| Livraison | ❌ OFF | Livraison à domicile |
| Commande en ligne | ❌ OFF | Vitrine + commandes web |
| Patients | ❌ OFF | Dossiers patients |
| Interactions | ❌ OFF | Alertes interactions médicamenteuses |
| Fidélité | ❌ OFF | Programme de points |
| Multi-dépôt | ❌ OFF | Plusieurs points de vente |

---

## Rôles utilisateurs (7)

| Rôle | Accès | Responsabilités |
|------|-------|-----------------|
| super_admin | /super-admin | Gestion de toutes les pharmacies |
| pharmacien | /admin/dashboard | Administration complète de la pharmacie |
| admin | /admin/dashboard | Administration (sans certaines fonctions pharmacien) |
| vendeur | /staff/dashboard | Ventes comptoir, ordonnances |
| preparateur | /staff/dashboard | Préparation commandes |
| caissier | /staff/caisse | Encaissement uniquement |
| livreur | /staff/livraisons | Livraisons à domicile |

---

## Tests

```bash
# Tests unitaires (Vitest)
cd server && npx vitest run

# Tests intégration (Supertest)
cd server && npm run test:integration

# Tests E2E (Playwright)
npx playwright test

# Rapport Playwright
npx playwright show-report e2e/reports
```

---

## Tests de performance

```bash
# Installer k6
winget install k6  # Windows
brew install k6    # macOS
sudo apt install k6  # Linux

# Test de charge normal
npm run perf:normal

# Test race condition stock
npm run perf:stock --env MED_ID=[uuid-medicament]

# Exporter résultats JSON
npm run perf:report
```

Seuils de performance cibles :
- 95% des requêtes < 500ms
- 99% des requêtes auth < 1s
- Taux d'erreur < 1%

---

## Structure du projet

```
GestPharma/
├── server/                  # API Node.js + Express + Prisma
│   ├── src/
│   │   ├── controllers/     # Logique métier (14 controllers)
│   │   ├── routes/          # Routes Express (14 groupes)
│   │   ├── middleware/       # Auth, tenant, upload
│   │   └── utils/           # FEFO, Socket.IO events, Prisma
│   └── prisma/
│       ├── schema.prisma    # 19 modèles, 9 enums
│       └── seed.js          # Données de démonstration
├── client/                  # SPA React 19 + Vite
│   └── src/
│       ├── pages/           # 31 pages (admin, staff, public, client)
│       ├── components/      # UI system + layouts
│       ├── contexts/        # TenantContext, AuthContext
│       └── hooks/           # useAxios, useSocket, useNotifications
├── e2e/                     # Tests Playwright
├── .github/workflows/       # CI/CD GitHub Actions
└── docker-compose.yml
```

---

## Variables d'environnement

Voir `server/.env.example` et `client/.env.example` pour la liste complète.

Variables obligatoires :
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=chaine-aleatoire-min-32-chars
JWT_REFRESH_SECRET=autre-chaine-differente
```

---

## Conformité pharmaceutique

- ✅ Circuit médicament complet (OMS)
- ✅ Principe FEFO (First Expired, First Out)
- ✅ Traçabilité par numéro de lot
- ✅ Journal des mouvements de stock (audit trail)
- ✅ DCI obligatoire sur toutes les fiches
- ✅ Validation ordonnances avant dispensation
- ✅ Alertes péremption configurables
- ⚠️ Module stupéfiants (prévu V2)

---

## Licence

Propriétaire — © 2026 GestPharma. Tous droits réservés.
