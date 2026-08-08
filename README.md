# GestSchool V1

> Progiciel SaaS multi-tenant de gestion scolaire  
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
| Infra | Docker Compose, Nginx, Render |

---

## Fonctionnalités principales

- **Multi-tenant** : chaque établissement a son espace isolé (données, branding, modules)
- **White-label** : couleurs, logo, police configurables par école (thème dérivé automatiquement)
- **Modules SaaS** activables/désactivables (élèves, notes, bulletins, absences, paiements, etc.)
- **Vie scolaire** : classes, inscriptions, emploi du temps, cahier de textes, sanctions
- **Pédagogie** : notes, bulletins, conseil de classe, certificats
- **Finances** : scolarités, échéances, encaissements, reçus
- **Portails** : directeur / secrétariat, enseignant, parent, caissier, super-admin
- **Temps réel** : notifications via Socket.IO

---

## Règles métier (inscription d’abord)

> **L’inscription est l’acte fondateur.** Elle lie un élève à une classe et une année scolaire, crée le dossier financier (solde + échéances) et, une fois **validée**, ouvre la vie scolaire (effectif, absences, notes, bulletins).

### Cycle de vie

| Étape | Statut | Effets |
|-------|--------|--------|
| Nouvelle inscription | `en_attente` | Fiche élève (créée ou réutilisée) + inscription + échéances (frais d’inscription + 3 tranches) |
| Validation | `validee` | Élève **scolarisé** : compte dans l’effectif, notes, bulletins, certificats |
| Suspension / annulation | `suspendue` / `annulee` | Hors vie scolaire active |
| Fin d’année | décision sur l’inscription | Passage / redoublement / orientation / exclusion ; peut générer l’inscription N+1 **avec les mêmes règles de frais** |

Endpoint unifié : `POST /api/inscriptions/avec-eleve` (nouvel élève **ou** élève existant + classe + année).  
Validation : `PUT /api/inscriptions/:id/validate`.

### Modules (dépendances)

- **Élèves** : annuaire d’identité ; badge « Non inscrit » / « Scolarisé » ; CTA Inscrire.
- **Inscriptions** : hub scolarisation + solde + décision fin d’année (directeur / DE).
- **Paiements** : toujours rattachés à une `inscriptionId`.
- **Bulletins / appel / effectif** : inscriptions `validee` uniquement.
- **Conseil de classe** : ne pousse pas automatiquement la décision fin d’année.

### Rôles (résumé)

| Rôle | Pédagogie | Finance |
|------|-----------|---------|
| Directeur | Tout + publication bulletins | Oui |
| Directeur des études | Classes, notes, calcul bulletins, fin d’année | Non |
| Secrétaire | Inscriptions, vie scolaire | API partielle |
| Gestionnaire (`comptable`) | Non | Caisse |
| Surveillant | Absences / sanctions | Non |
| Enseignant / Parent | Portails dédiés | Parent : voir / payer |

Référentiel Congo : niveaux PS→Tle, périodes par année, examens nationaux (CEPE / BEPC / BAC) — versionnés (`cg_actuel`, stub `cg_reforme_2026`).

### Règles de saisie

- **Date de naissance** : pas de date future ; âge entre **2 et 25 ans** (API + formulaires Élèves / Inscriptions).
- **Parent** : recommandé à l’inscription (`GET /api/parents`) ; sans lien, portail famille et relances indisponibles.
- **Filtres élèves** : `cycle`, `sexe`, `inscription` (sans / en_attente / validée) appliqués côté API via l’inscription de l’année active.
- **Solde** : lu sur l’inscription (année active), pas sur la fiche élève.
- **Classe « en attente »** : affichée tant que l’inscription n’est pas validée ; l’effectif ne compte que les `validee`.
- **EDT** : liste enseignants via `GET /api/staff/enseignants` (accessible aussi au directeur des études).
- **Année scolaire** : bascule manuelle (pas de changement automatique en août).

---

## Documentation API

La documentation interactive de l'API est disponible sur **http://localhost:3000/api/docs** (Swagger UI).

- Explorer les endpoints REST
- Tester les requêtes depuis l'interface
- Consulter les schémas requête/réponse
- Télécharger la spec OpenAPI via `/api/docs.json`

**Note** : pour les endpoints protégés, connectez-vous d'abord via `POST /api/auth/login` afin d'obtenir les cookies d'authentification.

---

## Démarrage rapide

### Prérequis

- Node.js 20+
- PostgreSQL 16+ (ou Docker)
- npm 10+

### Option 1 — Docker (recommandé)

```bash
git clone https://github.com/[username]/GestSchool.git
cd GestSchool
cp server/.env.example server/.env
# Éditer server/.env avec vos valeurs
docker-compose up -d
```

L'app sera disponible sur :

- Frontend : http://localhost:5173
- API : http://localhost:3000 (ou le port défini dans `.env`)

### Option 2 — Installation manuelle

```bash
# 1. Backend
cd server
cp .env.example .env
# Éditer .env : DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
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
| Super Admin | superadmin@gestschool.com | SuperAdmin123! | /super-admin |
| Directeur | directeur@demo.cg | Directeur123! | /admin/dashboard |
| Directeur des études | de@demo.cg | DirecteurEtudes123! | /admin/dashboard |
| Secrétaire | secretaire@demo.cg | Secretaire123! | /admin/dashboard |
| Enseignant | enseignant@demo.cg | Enseignant123! | /enseignant/dashboard |
| Surveillant | surveillant@demo.cg | Surveillant123! | /admin/dashboard |
| Comptable | comptable@demo.cg | Comptable123! | /caissier |

URL de l'école démo : http://localhost:5173/p/demo

---

## Architecture multi-tenant

Chaque établissement accède à son espace via :

- **Sous-domaine** (production) : `ecole.gestschool.com`
- **URL** (développement) : `localhost:5173/p/demo`

L'isolation des données est garantie par :

1. `tenantMiddleware` — résout le slug depuis l'URL / sous-domaine / header
2. `AsyncLocalStorage` — propage le `tenantId` dans le contexte async
3. `extendedPrisma` — injecte automatiquement `{ where: { tenantId } }` sur les requêtes Prisma

---

## Modules disponibles

| Module | Défaut | Description |
|--------|--------|-------------|
| Élèves | ✅ ON | Dossiers et inscriptions élèves |
| Classes | ✅ ON | Classes, niveaux et cycles |
| Matières | ✅ ON | Matières et coefficients |
| Notes & Bulletins | ✅ ON | Saisie des notes, génération de bulletins |
| Emploi du temps | ✅ ON | Planification des cours |
| Absences / Présences | ✅ ON | Appel et suivi des absences |
| Paiements | ✅ ON | Scolarités et échéances |
| Parents | ✅ ON | Portail parents |
| Sanctions | configurable | Discipline |
| Certificats | configurable | Attestations officielles |
| Personnel | ✅ ON | Comptes et rôles |
| Rapports | ✅ ON | Statistiques et analytics |
| Bibliothèque / Cantine / Transport | ❌ OFF | Modules optionnels |

---

## Rôles utilisateurs

| Rôle | Accès | Responsabilités |
|------|-------|-----------------|
| super_admin | /super-admin | Gestion de toutes les écoles (tenants, plans, modules) |
| directeur | /admin | Administration complète de l'établissement |
| directeur_etudes | /admin | Pilotage pédagogique |
| secretaire | /admin | Inscriptions, classes, secrétariat |
| enseignant | /enseignant | Classes, notes, appel, cahier de textes |
| surveillant | /admin | Absences, discipline |
| comptable | /caissier | Encaissements et suivi des paiements |
| parent | /parent | Suivi des enfants (notes, absences, facturation) |

---

## Tests

```bash
# Tests unitaires / intégration (Vitest)
cd server && npx vitest run

# Tests E2E (Playwright)
npx playwright test

# Rapport Playwright
npx playwright show-report e2e/reports
```

---

## Structure du projet

```
GestSchool/
├── server/                  # API Node.js + Express + Prisma
│   ├── src/
│   │   ├── controllers/     # Logique métier
│   │   ├── routes/          # Routes Express
│   │   ├── middleware/      # Auth, tenant, upload
│   │   ├── services/        # Email, métier
│   │   └── utils/           # Prisma, theme, Socket.IO
│   └── prisma/
│       ├── schema.prisma    # Modèles scolaires
│       └── seed.js          # Données de démonstration
├── client/                  # SPA React 19 + Vite
│   └── src/
│       ├── pages/           # admin, enseignant, parent, public, superadmin
│       ├── components/      # UI kit + AppShell + layouts
│       ├── contexts/        # Tenant, Auth, Theme, I18n, Density
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

## Licence

Propriétaire — © 2026 GestSchool. Tous droits réservés.
