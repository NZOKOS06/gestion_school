# MEMORY.md — Contexte projet GestSchool

> Fichier de contexte pour reprendre le projet rapidement (humain ou IA).
> Dernière analyse complète : **2026-10-02** (commit `dcfe440`, branche `main`, 55 commits).
> À mettre à jour après chaque évolution notable (section « Journal » en bas).

---

## 1. Identité

- **Produit** : GestSchool V1 — progiciel **SaaS multi-tenant white-label** de gestion scolaire (administratif, financier, pédagogique).
- **Marché** : écoles privées PS → Terminale, **Congo-Brazzaville** d'abord, puis Afrique francophone. Devise par défaut **FCFA**, langue **français**.
- **Philosophie** : « L'école reste maître de sa pédagogie, le logiciel gère l'administratif. »
- **Dépôt GitHub** : historique de PR `NZOKOS06/fix/security-hardening` ; auteur git local `IsraelMabanza`.
- **Docs de référence déjà dans le repo** :
  - `README.md` — démarrage, règles métier, comptes démo.
  - `BRIEFING_GESTSCHOOL.md` (~75 Ko) — briefing technique complet (schéma, acteurs, pages, algorithmes, sockets, API). ⚠️ Rédigé en juin 2026 : le schéma Prisma réel a beaucoup évolué depuis.
  - `RECAPITULATIF_EVOLUTION_SI.md` — journal des correctifs + matrice modules × rôles + **règles anti-régression**.
  - `implementation_plan.md` — plan stratégique « Vagues 1-3 » (caisse, async bulletins, offline, Excel, WhatsApp/SMS).
  - `.cursor/plans/socle_scolaire_complet_*.plan.md` — nouvelle doctrine « socle ON par défaut » (todos P0→P5 tous `pending`).
  - `server/docs/POINTAGE_BIOMETRIE.md`.

---

## 2. Stack

| Couche | Techno |
|---|---|
| Backend | Node 20 (ESM, `"type": "module"`), Express 4, Prisma 5, PostgreSQL 16 |
| Frontend | React 19, Vite 6, Tailwind 3.4, React Router 7, Radix UI, lucide-react, Recharts, react-hot-toast |
| Temps réel | Socket.IO 4 (auth JWT au handshake, rooms par tenant/rôle — `server/src/utils/schoolEvents.js`) |
| Auth | JWT double jeton en cookies HttpOnly (access ~15 min + refresh 7 j en base, rotation), bcrypt |
| Sécurité | Helmet (CSP stricte), CORS liste blanche explicite, rate-limit (auth 10/15 min en prod, API 200/min), body 2 Mo, IP whitelist staff par tenant |
| Cache | Redis (`REDIS_URL`) sinon mémoire process (`utils/cache.js`) ; Cache-Control HTTP (`utils/httpCache.js`) |
| PDF / Excel | PDFKit (`server/src/services/pdf/*`), ExcelJS (import/export notes) |
| Médias | Cloudinary (+ fallback `/uploads` local) |
| Email / msg | Nodemailer SMTP ou Brevo ; services `sms`, `whatsapp`, `momo.sandbox` (Mobile Money en sandbox) |
| Observabilité | Pino (+ pino-pretty), Sentry (node + react), Swagger `/api/docs` (super_admin en prod) |
| PWA / offline | `vite-plugin-pwa` (Workbox) + IndexedDB (`client/src/services/offlineDb.js`, `offlineSync.js`) |
| Tests | Vitest (server), Playwright E2E (racine `e2e/`), k6 (charge, `k6/`) |

---

## 3. Arborescence utile

```
server/
  src/index.js              # bootstrap Express, CORS, Helmet, rate-limit, montage des routes, Socket.IO, crons
  src/config.js             # config env
  src/config/v1Modules.js   # modules critiques / plans / enforceModuleConstraints
  src/middleware/           # tenantMiddleware, authMiddleware (authenticate/requireRole/requireTenantMatch), upload, requestLogger
  src/routes/ (38)          # 1 fichier par domaine, montés sous /api/<domaine>
  src/controllers/ (38)     # logique métier
  src/services/             # echeances, facturation, bulletins(+Queue), affectations, pointage, email/sms/whatsapp, pdf/*
  src/jobs/                 # relances.job.js (échéances), alertesCalendrier.job.js — lancés au boot
  src/utils/                # prisma (isolation tenant), anneeActive, tenantBootstrap, tenantCycles, auditLogger, cache…
  src/data/referentielCongo.js  # niveaux PS→Tle, périodes, examens CEPE/BEPC/BAC
  prisma/schema.prisma      # ~1680 lignes, ~60 modèles
  prisma/migrations/        # 23 migrations (dernière : 20260918100000_classe_frais_detail)
  prisma/seed.js            # tenant "demo" + comptes démo
  scripts/                  # runbooks (passage d'année, sync super admin, assert-prod-ready, bootstrap-if-empty…)
  start.sh / Dockerfile     # image prod (Render)
client/
  src/App.jsx               # toutes les routes + ProtectedRoute par rôles
  src/components/layouts/   # AppShell, AdminLayout, CaissierLayout, EnseignantLayout, ParentLayout, navConfig.js
  src/components/ui/        # design system maison (DataTable, Modal, KpiCard/KpiGrid, Drawer…)
  src/contexts/             # Auth, Tenant, Theme, I18n (fr/en/ar RTL), Density
  src/pages/{admin,enseignant,parent,public,superadmin}/
  src/utils/axios.js        # withCredentials, 3 retries (GET/réseau/5xx/429), header X-Tenant-Slug
  src/utils/pdf.js, printUtils.js, themeEngine.js
e2e/                        # 01-login, 02-flux-vente, 03-superadmin, 04-rapports, 05-smoke-scolaire
```

---

## 4. Architecture multi-tenant (cœur à ne pas casser)

- **Base partagée, schéma partagé**, isolation logique par `tenantId`.
- `tenantMiddleware` résout le slug dans cet ordre : sous-domaine (`SUBDOMAIN_MODE=true`) → URL `/e/:slug` (ou legacy `/p/:slug`) → `?tenant=` → header `X-Tenant-Slug` → `tenantId` du JWT → fallback `VITE_DEFAULT_TENANT` (`demo`).
- `AsyncLocalStorage` propage `tenantId` ; `prisma` (extended) injecte automatiquement `where/data.tenantId` sur les modèles de `TENANT_MODELS` (`server/src/utils/prisma.js`).
- `rawPrisma` **contourne** l'isolation → réservé super-admin, auth, jobs globaux. Tout nouveau modèle avec `tenantId` **doit être ajouté à `TENANT_MODELS`**.
- `requireTenantMatch` : `req.user.tenantId === req.tenantId` sauf `super_admin`.
- Le `ProtectedRoute` React n'est que de l'UX ; la sécurité est côté serveur.
- Tests dédiés : `tenantMiddleware.test.js`, `prisma.tenantIsolation.test.js`.

---

## 5. Rôles & portails

Rôles staff (`enum StaffRole`) : `super_admin`, `directeur`, `directeur_etudes`, `secretaire`, `enseignant`, `surveillant`, `comptable` (= caissier/gestionnaire). Les **parents** sont dans le modèle `User` (pas `Staff`, pas de colonne `role`).

| Portail | Route | Rôles |
|---|---|---|
| Admin | `/admin/*` | directeur, directeur_etudes, secretaire, surveillant (accès variable par page — cf. `App.jsx`) |
| Caisse | `/caissier/*` | comptable, directeur |
| Enseignant | `/enseignant/*` | enseignant |
| Parent | `/parent/*` | parent |
| Super Admin | `/super-admin/*` | super_admin |
| Public | `/`, `/e/:slug`, `/e/:slug/login`, pages légales | — |

Points notables : `/admin/paiements`, `/admin/rapports`, `/admin/personnel` = directeur seul ; `/admin/bulletins` = directeur + DE ; `/admin/configuration` = directeur + super_admin.

### Comptes démo (seed, tenant `demo`)
superadmin@gestschool.com / SuperAdmin123! · directeur@demo.cg / Directeur123! · de@demo.cg / DirecteurEtudes123! · secretaire@demo.cg / Secretaire123! · enseignant@demo.cg / Enseignant123! · surveillant@demo.cg / Surveillant123! · comptable@demo.cg / Comptable123!

---

## 6. Règles métier clés

- **L'inscription est l'acte fondateur** : lie élève + classe + année, crée le dossier financier (échéances), et une fois `validee` ouvre la vie scolaire (effectif, notes, absences, bulletins, certificats).
  - Statuts : `en_attente` → `validee` / `suspendue` / `annulee`.
  - Endpoint unifié : `POST /api/inscriptions/avec-eleve` ; validation `PUT /api/inscriptions/:id/validate`.
  - Fin d'année : décision (`passage / redoublement / orientation / exclusion`) → peut générer l'inscription N+1.
- **Paiements** toujours rattachés à une `inscriptionId`. Solde lu sur l'inscription (année active), pas sur l'élève.
- **Frais de classe** : `fraisInscription` + `fraisMensuel` × `nombreMois` (migration du 18/09/2026) → scolarité annuelle calculée.
- **Caisse** : sessions ouvertes/clôturées (`CaisseSession`, fond de caisse, billetterie, écart), annulation de paiement tracée (`PaiementAnnulation`), journal de caisse PDF.
- **Année scolaire** : une seule active par tenant (index unique), bascule **manuelle** (`scripts/passage-annee-runbook.js`).
- **Périodes** : auto-bootstrap des périodes officielles selon les cycles de l'école (`listPeriodes`, création d'année).
- **Cycles** : cloisonnement strict (superadmin → tenant `concerneCycles` → classes/niveaux/périodes) ; `utils/tenantCycles.js`.
- **Référentiel Congo** versionné : `cg_actuel` (+ stub `cg_reforme_2026`) ; examens nationaux CEPE / BEPC / BAC.
- **Notes** : verrou anti-fraude (`saisieNotesOuverte`), traçabilité via `AuditLog`.
- **Saisie** : date de naissance non future, âge 2–25 ans ; parent recommandé à l'inscription.
- **Modules** : flags `module*` sur `TenantConfig`. Critiques toujours ON : élèves, classes, inscriptions, paiements. Le **super-admin a le plein contrôle** des toggles (verrous par plan retirés de l'UI et de la création/MAJ tenant le 17/09/2026). `enforceModuleConstraints` existe encore dans `v1Modules.js` (+ test) mais n'est plus appelé par le contrôleur superadmin. La nav masque les modules désactivés (`navConfig.js` → `module:` + filtrage `AppShell.jsx`).

### Règles anti-régression (issues de RECAPITULATIF_EVOLUTION_SI.md)
1. Ne jamais crasher (500) sans année scolaire active ou avec données vides (école neuve).
2. Optional chaining + fallbacks sur relations optionnelles (`inscription.eleve`, `classe`, `anneeScolaire`).
3. Étanchéité tenant absolue sur toute requête.

---

## 7. Déploiement & environnements

- **Cloud (prod)** : front **Vercel** (`client/vercel.json`, `client/.env.production` → `GestSchool-api.onrender.com` / `GestSchool-two.vercel.app`), API **Render** (`render.yaml`, Docker, région Frankfurt, health `/api/health`), DB **Neon** Postgres, médias Cloudinary, Redis optionnel.
  - Boot : `start.sh` → `assert-prod-ready.js`, migrations, `bootstrap-if-empty` (seed auto si base vide). `SUPER_ADMIN_PASSWORD` ≥ 12 car. et ≠ `SuperAdmin123!` en prod.
- **Local dev** : `docker-compose.yml` ou manuel (`server`: `npm run dev`, port 3000 ; `client`: `npm run dev`, port 5173).
- **Physique / LAN école (offline)** : `docker-compose.offline.yml` (Postgres + Redis + API + Nginx port 80, zéro cloud), lanceurs `lancer-gestschool-physique.bat` (Windows) et `lancer-gestschool-linux.sh`, config `.env.local.example`.
- **CI** (`.github/workflows/ci.yml`, push main/develop + PR) : Vitest + `npm run test:integration` sur Postgres 16 → build Vite → E2E Playwright (seed demo). **Deploy** (`deploy.yml`) : `workflow_dispatch` staging/production avec preflight.
- **Crons au boot** : nettoyage tokens expirés (24 h), relances échéances, alertes calendrier.

### Commandes
```bash
cd server && npm run dev            # API (nodemon)
cd server && npx prisma migrate dev # migration
cd server && npm run db:seed        # données démo
cd server && npx vitest run         # tests unitaires
cd server && npm run test:integration
cd client && npm run dev            # front
npx playwright test                 # E2E (racine)
```

---

## 8. Dette technique / points d'attention relevés (2026-10-02)

- **Fichiers suivis qui ne devraient pas l'être** : `client/audit_client.txt`, `server/audit_server.txt` (le commit `bd4c83b` dit les avoir supprimés mais ils sont toujours versionnés), `server/preview-recu.pdf`, `e2e/reports/**`, `server/.env.test`, `client/.env.production` (URLs publiques seulement, OK mais à surveiller).
- **Scripts hérités d'un autre projet (pharmacie « GestPharma »)** inutilisables ici : `server/scripts/fix-medicament-ids.*`, `fix-lot-prix.js`, `fix-marges.js`, `check-ventes-marges.js` ; test E2E `02-flux-vente.spec.js` probablement aussi hérité.
- `BRIEFING_GESTSCHOOL.md` mentionne parfois « hérite de GestSchool » (copier-coller du projet d'origine) et un schéma Prisma obsolète → **la source de vérité est `server/prisma/schema.prisma`**.
- Divergence doctrine : README/`v1Modules.js` décrivent le « gel V1 » (modules hors cœur OFF), alors que le plan Cursor et les commits du 17/09 donnent tout pouvoir au super-admin (« socle ON »). `moduleFlagsForPlan` sert encore aux valeurs par défaut à la création.
- `BRIEFING`/`implementation_plan.md` contiennent des liens `file:///d:/GestSchool/...` (ancien chemin).
- Duplication `/api/staff` et `/api/personnel` (même router) ; route `/health` déclarée deux fois dans `index.js`.
- `console.log('[Axios] API URL')` en clair dans `client/src/utils/axios.js`.

---

## 9. Conventions

- Code, UI, commits et docs **en français** ; commits en Conventional Commits (`feat(scope):`, `fix(scope):`, `security:`, `docs:`).
- Réponses API : `{ success, message, data }` / erreurs avec `message` en français.
- Nouvelle fonctionnalité de module → flag `module*` dans `TenantConfig` + migration + `navConfig.js` (`module:`) + garde serveur.
- Nouveau modèle tenant → `tenantId` + index + ajout dans `TENANT_MODELS`.
- Après correctif notable → ajouter une ligne dans `RECAPITULATIF_EVOLUTION_SI.md` **et** dans le journal ci-dessous.

---

## 10. Feuille de route validée (2026-10-02)

Décisions du porteur de projet :
- **Session** : 15 h absolues depuis la connexion (`TenantConfig.dureeSessionMinutes`, défaut 900 ; super-admin via `SESSION_DURATION_MINUTES`). Access token 15 min renouvelé silencieusement. ✅ fait
- **Régimes plein temps / mi-temps** : option école. **Services optionnels** (cantine, garderie, crèche = service, TD, transport…) : catalogue géré par l'école, cumulables avec la scolarité, souscription à l'inscription ou en cours d'année, tarif spécial par service. Prix figés sur l'inscription / la souscription. ✅ fait
- **Frais d'inscription / réinscription** : par classe, sinon défaut école (écran Configuration) ; **toujours modifiables élève par élève** (cas sociaux) avec motif obligatoire tracé. ✅ fait
- **Retenues paie** (retards/absences issus du pointage) : activables ou non par l'école ; mode proportionnel par défaut (amendes forfaitaires à valider juridiquement).
- **Paie programmée** : jour de paie configurable (ex. 10), compte à rebours chez le directeur, ouverture par directeur/secrétaire du **mois écoulé** uniquement ; module paie visible chez la gestionnaire seulement si période ouverte.
- **Recettes diverses** : catalogue (maillots, émulation, uniformes…) + catégories recettes/dépenses gérées par l'école.
- **Documents** (carte blanche) : modèles paramétrables par école (en-tête officiel, cachet/signature, A4/A5/ticket 80 mm) → analyse IA d'un document existant avec validation humaine → éditeur visuel.
- **Multi-sites** : tous en ligne ; entité « Groupe scolaire » au-dessus des tenants (pas de `siteId` partout) ; mode hors-ligne via IndexedDB (extension de `offlineSync.js`) + synchro au retour réseau.

- **Portail parent** : module activable par le super-admin ; absences/sanctions/messages/annonces toujours transmis ; notes/bulletins seulement si scolarité du mois écoulé réglée (services exclus), dérogation possible par le directeur avec motif ; case « espace parent » décochée par défaut à l'inscription. ✅ fait

Lots : 1 session + bugs EDT ✅ · 2 grille horaire (créneaux, pauses/récréations) ✅ · 3 régimes & cantine ✅ · 4 paie programmée + retenues · 5 recettes/dépenses & catalogue · 6 bulletins · 7 modèles de documents · 8 multi-sites + offline.

---

## 11. Journal (récent → ancien)

| Date | Commit | Résumé |
|---|---|---|
| 2026-10-02 | — | Réinitialisation des comptes parents `Parent123!` : révocation automatique à la connexion (passwordHash null, portailActif false, audit), mots de passe connus interdits au changement (`utils/motsDePasseCompromis.js`), script **à lancer une fois après déploiement** `node scripts/reinitialiser-mdp-parents.js [--appliquer]`. Mot de passe parent de démo → `ParentDemo123!` (seed + e2e) |
| 2026-10-02 | — | Portail parent (module `moduleParents`, choisi par le super-admin à la création de l'école, OFF par défaut) : `User.portailActif/mustChangePassword` (fiche tuteur sans mot de passe tant que l'espace n'est pas activé ; fin du mot de passe commun `Parent123!`), activation à l'inscription (case décochée par défaut, visible seulement si module actif) ou via `PUT /api/parents/:id/portail` → mot de passe provisoire `ABCD-2345` affiché une fois ; connexion parent par email **ou téléphone** ; middleware bloque si module coupé ou accès retiré. Notes/bulletins visibles seulement si la **scolarité** échue avant le mois en cours est réglée (services exclus) sauf **dérogation directeur** (`Inscription.derogationNotes` + motif, `PUT /api/inscriptions/:id/derogation-notes`) — `services/portailParent.service.js` ; notifications parents filtrées (module/accès, notes masquées si impayé). Annonces : `Annonce` + `AnnonceDestinataire` (cible tous/cycle/classe/impayés), `/api/annonces`, `/api/parent/annonces` ; pages admin/Annonces et parent/AnnoncesParent. Migration `20261002150000_portail_parent` |
| 2026-10-02 | — | Services optionnels (remplace la cantine codée en dur) : `ServiceOptionnel` (catalogue école : nom, tarif, périodicité mensuelle/trimestrielle/annuelle/unique, cycles ciblés ; suggestions Cantine, Garderie, Crèche, TD) + `SouscriptionService` (par inscription, tarif figé/spécial) + `Echeance.souscriptionServiceId`, catégorie `service` ; migration `20261002140000_services_optionnels` (reprend les données cantine puis supprime les champs cantine). API `/api/services-optionnels` (CRUD), `GET/PUT /api/inscriptions/:id/services[/:serviceId]`, `services` dans création d'inscription et `frais-preview`. Cascade de paiement : scolarité avant services. `typePaiement` déduit de l'échéance payée. Service = `servicesOptionnels.service.js` |
| 2026-10-02 | — | Lot 3 régimes & cantine (options école `TenantConfig.regimesActifs/cantineActive/cantinePeriodicite/tarifCantine`) : `Classe.fraisMensuelMiTemps/fraisScolariteMiTemps`, `Inscription.regime/cantine/tarifCantineApplique`, `Echeance.categorie` (inscription/scolarite/cantine, backfill ; `categorieEcheance()` remplace la détection par libellé) — migration `20261002130000_regimes_cantine` ; `PUT /api/inscriptions/:id/cantine` (souscription dès la période en cours / résiliation des périodes futures), changement de régime via `PUT /:id/tarif`, `GET /api/rapports/regimes` ; cascade de paiement ignore les échéances annulées ; facturation annuelle utilise le tarif figé. La cantine n'est pas reconduite automatiquement en N+1 (re-souscription explicite) |
| 2026-10-02 | — | Lot 2 grille horaire : modèle `CreneauHoraire` (commune ou par cycle, type cours/pause/recreation ; migration `20261002120000_creneau_horaire`), routes `GET/PUT /api/emplois-du-temps/creneaux`, refus d'un cours sur pause/récréation ; composant partagé `client/src/components/EmploiGrid.jsx` (lignes = créneaux début–fin, bandeaux pauses, cours hors grille) + `GrilleHoraireEditor.jsx` (générateur de journée type) ; page admin : édition/suppression d'un cours, erreur de conflit serveur affichée ; vue enseignant `MonEmploi` sur la même grille |
| 2026-10-02 | — | Frais d'inscription / réinscription + tarif spécial : `services/fraisInscription.service.js` (résolution classe → défaut école, détection réinscription = élève inscrit une autre année), champs `Classe.fraisReinscription`, `TenantConfig.fraisReinscriptionDefault`, `Inscription.typeFrais/fraisInscriptionApplique/fraisScolariteApplique/tarifSpecial/motifTarifSpecial` (migration `20261002110000_…`), routes `GET /api/inscriptions/frais-preview`, `PUT /api/inscriptions/:id/tarif` (motif obligatoire, audit) ; UI : Classes, Configuration (frais par défaut), assistant d'inscription, bouton « Modifier le tarif » ; suppression du repli sur la config `demo` dans Inscriptions.jsx |
| 2026-10-02 | — | Lot 1 : session 15 h (`issueSession` dans auth.controller, migration `20261002100000_session_15h`) ; EDT : conflits à la minute (classe / enseignant / salle) en création **et** modification via `utils/horaires.js`, suppression du champ `actif` inexistant ; fix `catch` login (`tenantId` hors portée) |
| 2026-10-02 | — | Création de ce MEMORY.md (analyse complète du repo) |
| ~2026-09/10 | `dcfe440` | Fix impression bulletin, audit logs enrichis (KPIs, acteurs), nouveau login moderne |
| | `bd4c83b` | Limite payload Express 2 Mo |
| | `17d4844` / `b71c808` | Bouton PWA (navbar + header SuperAdmin), KPI grid 2×3, QR code URL dynamique, npm audit fix |
| 2026-09-18 | `17c8aa9`, `ca3275e`, `4107230` | Auto-bootstrap périodes, frais détaillés par classe, fix `selectedClasse` Inscriptions |
| 2026-09-17 | `77ce1a6`…`1fb9528` | Migration sessions caisse, toggles modules libres pour superadmin, nav filtrée, slug au login `/e/:slug`, reset mdp staff depuis superadmin |
| | `b07b9db` | Vagues 1-3 : immunisation & croissance, PWA offline, déploiement physique, durcissement sécurité |
| 2026-08 | `9d52859`, `89f9880`, `25317eb` | Cloisonnement des cycles, KPIs paie, messagerie, verrou notes anti-fraude, wizard d'inscription avec tuteur obligatoire, reçus paie |
