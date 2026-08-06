# GESTSCHOOL V1 — BRIEFING TECHNIQUE COMPLET
### Document de référence pour IA et développeurs
*Architecture SaaS multi-tenant GestSchool*
*Date : Juin 2026*

---

## ━━━ SECTION 1 — IDENTITÉ DU PROJET ━━━

*   **NOM** : GestSchool V1
*   **TYPE** : Progiciel SaaS multi-tenant white-label (Base de données partagée, Schéma partagé, isolation logique par `tenantId`)
*   **DOMAINE** : Gestion administrative, financière et pédagogique d'établissements scolaires
*   **MARCHÉ CIBLE** : Écoles primaires, collèges et lycées d'Afrique francophone (Congo-Brazzaville, Cameroun, RDC, Côte d'Ivoire, Sénégal, etc.)
*   **DEVISE PAR DÉFAUT** : FCFA (XAF/XOF), configurable individuellement par tenant (USD, EUR, etc.)
*   **LANGUE** : Français
*   **PHILOSOPHIE CENTRALE** :  
    *"L'école reste maître de sa pédagogie, le logiciel gère l'administratif."*  
    Le système fournit une automatisation complète des processus de scolarité, de comptabilité et de communication avec les parents, tout en laissant l'équipe pédagogique libre de ses critères d'évaluation et de son organisation interne grâce à un moteur hautement paramétrable.

---

## ━━━ SECTION 2 — STACK TECHNIQUE ━━━

GestSchool V1 hérite rigoureusement de la stack moderne, éprouvée et sécurisée de GestSchool :

### BACKEND
*   **Runtime** : Node.js `>=18.0.0` (recommandé v20 LTS)
*   **Framework** : Express.js `^4.21.1` (architecture REST structurée)
*   **ORM** : Prisma `^5.22.0` (génération client, migrations déclaratives)
*   **Base de données** : PostgreSQL (avec support des index avancés, JSONB, contraintes d'intégrité)
*   **Temps réel** : Socket.IO `^4.8.1` (notifications d'absences, notes saisies, alertes paiements)
*   **Authentification** : Dual Token JWT (AccessToken 15 mins dans un cookie `HttpOnly` + RefreshToken 7 jours en base de données avec rotation automatique)
*   **Security & Encryption** : Bcryptjs `^2.4.3` (12 rounds de salage), Helmet `^8.2.0` pour la protection des headers et de la CSP, Express Rate Limit `^8.5.2` (limiteurs distincts pour l'authentification et l'API)
*   **Logging** : Pino `^10.3.1` et `pino-pretty` `^13.1.3` (logs JSON structurés en production, lisibles en développement)
*   **Monitoring & Error Tracking** : Sentry `@sentry/node` `^10.57.0` avec `@sentry/profiling-node` `^10.57.0`
*   **Email** : Nodemailer `^6.9.16` avec intégration de l'API Transactionnelle Brevo ou SMTP classique
*   **Upload de fichiers** : Multer `^1.4.5-lts.1` + Cloudinary `^1.41.3` + `multer-storage-cloudinary` `^4.0.0` (gestion robuste et performante des logos, photos d'élèves et pièces justificatives)
*   **Documentation API** : Swagger (`swagger-jsdoc` `^6.3.0` + `swagger-ui-express` `^5.0.1`)
*   **PDF** : PDFKit `^0.15.1` (moteur de rendu haute fidélité pour les bulletins scolaires, reçus de paiement et certificats de scolarité)

### FRONTEND
*   **Framework** : React `^19.0.0` (avec React DOM `^19.0.0`)
*   **Build Tool** : Vite `^6.0.1`
*   **Style & CSS** : Tailwind CSS `^3.4.0` (compilation optimisée par `postcss` `^8.4.49` et `autoprefixer` `^10.4.20`)
*   **Routing** : React Router DOM `^7.0.1` (gestion dynamique des espaces utilisateurs, guards de rôles et layouts)
*   **HTTP Client** : Axios `^1.7.7` (configuré avec `withCredentials: true` pour le transfert des cookies sécurisés et injection automatique du header `X-Tenant-Slug`)
*   **Temps réel** : Socket.IO Client `^4.8.1`
*   **Fonts** : Plus Jakarta Sans (corps du texte et titres) + JetBrains Mono (chiffres, montants, codes barres cartes scolaires) via Google Fonts
*   **Animations** : CSS custom déclarées dans `@/client/src/styles/index.css` hérité de GestSchool (classes utilitaires `fade-up`, `animate-slide-in`, `animate-modal-enter`, `pulse-danger`, `skeleton` pour le chargement)
*   **PWA** : `vite-plugin-pwa` `^0.21.0` (gestion hors ligne de l'application, mise en cache sélective des ressources statiques et images)
*   **Charts & Visualisation** : Recharts `^2.13.3` (statistiques de réussite, évolution des moyennes, répartition des paiements)
*   **Toast Notifications** : `react-hot-toast` `^2.4.1`

### ARCHITECTURE MULTI-TENANT (Identique GestSchool)
L'isolation multi-tenant de GestSchool repose sur 4 piliers technologiques :
1.  **tenantMiddleware** : Intercepte chaque requête HTTP, résout le tenant via 5 méthodes imbriquées (voir ci-dessous), vérifie son statut actif, et injecte le tenant résolu dans `req.tenant` et `req.tenantId`.
2.  **AsyncLocalStorage** : Encapsule la requête dans un magasin de contexte asynchrone pour propager le `tenantId` à travers toute l'exécution asynchrone de la requête, sans avoir à le passer de fonction en fonction.
3.  **extendedPrisma** : Version enrichie du client Prisma (`@/server/src/utils/prisma.js`) qui intercepte automatiquement toutes les opérations de lecture, d'écriture et de mise à jour sur les modèles multi-tenant pour y ajouter une clause `where: { tenantId }` ou injecter `tenantId` dans les données créées.
4.  **assertTenantMatch / requireTenantMatch** : Middleware de sécurité qui garantit qu'un utilisateur authentifié ne peut interagir qu'avec les données appartenant au même `tenantId` que le sien (sauf pour le rôle `super_admin`).

### RÉSOLUTION DU SLUG TENANT (Priorité de gauche à droite)
```
[Hôte / DNS] ──► [URL /e/:slug] ──► [Query ?tenant=slug] ──► [Header X-Tenant-Slug] ──► [JWT tenantId] ──► [Fallback VITE_DEFAULT_TENANT]
```
*   **Mode Sous-domaine (`SUBDOMAIN_MODE=true`)** : Extrait la première section de l'hôte (ex : `lyceesavorgnan.gestschool.com` -> `lyceesavorgnan`). Ignoré en local ou si l'hôte est brut.
*   **Mode URL Path (`/e/:slug`)** : Utilisé pour les espaces publics (ex : `/e/lyceesavorgnan/login` -> `lyceesavorgnan`).
*   **Query Parameter (`?tenant=slug`)** : Idéal pour les redirections et les appels d'API spécifiques.
*   **Header Custom (`X-Tenant-Slug`)** : Envoyé systématiquement par l'intercepteur Axios du client frontend.
*   **JWT Decoded ID** : Si l'utilisateur possède un token valide mais qu'aucun slug n'est fourni, récupération du `tenantId` inclus dans la signature du token JWT.
*   **Fallback d'environnement** : En développement, lit la variable `VITE_DEFAULT_TENANT` (valeur par défaut : `demo`).

---

## ━━━ SECTION 3 — ARCHITECTURE MULTI-TENANT ━━━

GestSchool V1 utilise la stratégie d'isolation **Logical Tenant Separation (Shared Database + Shared Schema)**.

### Le flux d'exécution d'une requête API
1.  Le serveur Express reçoit une requête pour `/api/eleves/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`.
2.  Le `tenantMiddleware` extrait le slug (ex : `mbandza-scolaire`) via les en-têtes ou l'URL.
3.  Il effectue un appel direct en base de données (sans filtrage, via `rawPrisma`) pour trouver le tenant :
    ```js
    const tenant = await rawPrisma.tenant.findUnique({
      where: { slug: 'mbandza-scolaire' },
      include: { config: true }
    });
    ```
4.  Si le tenant est inactif ou introuvable, la requête est rejetée immédiatement avec un code d'erreur `403` ou `404`.
5.  Le middleware initialise `AsyncLocalStorage` :
    ```js
    asyncLocalStorage.run({ tenantId: tenant.id }, () => next());
    ```
6.  La requête passe par le middleware `authenticate` :
    *   Le JWT est vérifié.
    *   La structure de l'utilisateur est injectée dans `req.user`.
    *   Le middleware `requireTenantMatch` vérifie que `req.user.tenantId === req.tenantId`.
7.  Le contrôleur appelle Prisma pour récupérer l'élève :
    ```js
    const eleve = await prisma.eleve.findUnique({ where: { id: req.params.id } });
    ```
8.  L'extension `extendedPrisma` intercepte l'appel. Puisqu'un `tenantId` est actif dans `AsyncLocalStorage`, elle réécrit la requête de manière transparente :
    ```sql
    SELECT * FROM "Eleve" WHERE "id" = $1 AND "tenantId" = $2;
    ```
    *Garantie absolue : aucun développeur ne peut accidentellement oublier la clause `where: { tenantId }`, empêchant toute fuite de données entre les établissements scolaires.*

---

## ━━━ SECTION 4 — BASE DE DONNÉES (PRISMA SCHEMA) ━━━

Voici le schéma Prisma complet pour GestSchool V1, conçu pour hériter des performances et des patterns d'indexation de GestSchool.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// 1. MODÈLES CORE & MULTI-TENANT (Identiques GestSchool)
// ==========================================

model Tenant {
  id                  String   @id @default(uuid())
  nom                 String
  slug                String   @unique
  customDomain        String?
  plan                String   @default("basique") // basique | premium | pro
  actif               Boolean  @default(true)
  numeroAutorisation  String?
  contact             Json?    // {adresse, telephone, email}
  modeMaintenance     Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // Relations Core
  config         TenantConfig?
  staff          Staff[]
  users          User[] // Parents connectés
  auditLogs      AuditLog[]
  cookieConsents CookieConsent[]

  // Relations Scolaires
  eleves          Eleve[]
  anneesScolaires AnneeScolaire[]
  classes         Classe[]
  matieres        Matiere[]
  inscriptions    Inscription[]
  evaluations     Evaluation[]
  bulletins       Bulletin[]
  paiements       Paiement[]
  emploisDuTemps  EmploiDuTemps[]
  absences        Absence[]
  sanctions       Sanction[]
  actualites      Actualite[]

  @@index([slug])
}

model TenantConfig {
  id                     String  @id @default(uuid())
  tenantId               String  @unique
  nomEcole               String  @default("GestSchool")
  slogan                 String?
  logoUrl                String?
  faviconUrl             String?
  backgroundImageUrl     String?
  loaderUrl              String?
  
  // Personnalisation Graphique (Thème White-label)
  couleurPrimaire        String  @default("#1e3a8a") // Bleu académique par défaut
  couleurSecondaire      String  @default("#0d9488")
  couleurTexte           String  @default("#1f2937")
  couleurAlerte          String  @default("#f59e0b")
  couleurErreur          String  @default("#ef4444")
  couleurSucces          String  @default("#22c55e")
  darkModeDefault        Boolean @default(false)
  police                 String  @default("Plus Jakarta Sans")
  
  // Coordonnées Établissement
  adresse                String?
  telephone              String?
  email                  String?
  devise                 String  @default("FCFA")
  messageAccueil         String?
  
  // Paramétrage Pédagogique
  anneeScolaireActiveId  String? // Id de l'AnneeScolaire en cours
  notationSur            Int     @default(20)    // Notes sur 20 ou sur 100
  seuilReussite          Decimal @default(10.00) @db.Decimal(5, 2) // Moyenne minimale pour passer
  nombrePeriodes         Int     @default(3)     // 3 pour Trimestres, 2 pour Semestres
  joursEcole             Json?   // ex: ["lundi", "mardi", "mercredi", "jeudi", "vendredi"]
  heureDebut             String  @default("08:00")
  heureFin               String  @default("17:00")
  
  // Paramétrage Financier
  fraisInscriptionDefault Decimal @default(0.00) @db.Decimal(12, 2)
  fraisScolariteDefault   Decimal @default(0.00) @db.Decimal(12, 2)
  
  // Modules SaaS activables/désactivables (12)
  moduleNotes            Boolean @default(true)
  moduleBulletins        Boolean @default(true)
  modulePresences        Boolean @default(true)
  modulePaiements        Boolean @default(true)
  moduleEmploiDuTemps    Boolean @default(true)
  moduleParents          Boolean @default(true)
  moduleEleves           Boolean @default(false)
  moduleSanctions        Boolean @default(true)
  moduleBiblio           Boolean @default(false)
  moduleCantine          Boolean @default(false)
  moduleTransport        Boolean @default(false)
  moduleCertificats      Boolean @default(true)

  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model Staff {
  id                 String   @id @default(uuid())
  tenantId           String
  email              String
  emailVerified      Boolean  @default(false)
  passwordHash       String
  role               StaffRole
  nom                String
  prenom             String
  telephone          String?
  mustChangePassword Boolean  @default(true)
  actif              Boolean  @default(true)
  derniereConnexion  DateTime?
  lastIp             String?
  lastUserAgent      String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  // Relations pédagogiques spécifiques
  enseignantClasses EnseignantClasse[]
  emploisDuTemps    EmploiDuTemps[]
  paiementsRecus    Paiement[]       @relation("RecuPar")

  @@unique([tenantId, email])
  @@index([tenantId])
  @@index([role])
}

// Représente le Parent connecté au système (équivalent du Client connecté dans GestSchool)
model User {
  id                String    @id @default(uuid())
  tenantId          String
  email             String
  emailVerified     Boolean   @default(false)
  passwordHash      String?
  nom               String
  prenom            String
  telephone         String?
  adresse           String?
  actif             Boolean   @default(true)
  derniereConnexion DateTime?
  lastIp            String?
  lastUserAgent     String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  // Un parent peut avoir plusieurs enfants (élèves) dans l'école
  enfants Eleve[]

  @@unique([tenantId, email])
  @@index([tenantId])
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([token])
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  email     String
  token     String   @unique
  userType  String   @default("staff") // staff | client (parent)
  tenantId  String?
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([email])
  @@index([token])
}

model EmailVerificationToken {
  id        String   @id @default(uuid())
  email     String
  token     String   @unique
  userType  String   @default("staff") // staff | client (parent)
  tenantId  String?
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([email])
  @@index([token])
}

model CookieConsent {
  id          String   @id @default(uuid())
  tenantId    String
  userId      String?
  sessionId   String?
  necessary   Boolean  @default(true)
  analytics   Boolean  @default(false)
  marketing   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@unique([tenantId, sessionId])
  @@unique([tenantId, userId])
}

// ==========================================
// 2. MODÈLES MÉTIER SCOLARISE (Adaptation GestSchool)
// ==========================================

model AnneeScolaire {
  id        String   @id @default(uuid())
  tenantId  String
  libelle   String   // ex: "2025-2026"
  dateDebut DateTime
  dateFin   DateTime
  actif     Boolean  @default(false) // Une seule année est active à la fois par tenant
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  classes      Classe[]
  inscriptions Inscription[]
  bulletins    Bulletin[]
  evaluations  Evaluation[]

  @@unique([tenantId, libelle])
  @@index([tenantId])
  @@index([actif])
}

model Classe {
  id              String   @id @default(uuid())
  tenantId        String
  anneeScolaireId String
  nom             String   // ex: "6ème A", "Terminale S1"
  niveau          String   // ex: "6eme", "terminale" (pour regroupement)
  filiere         String?  // ex: "Scientifique", "Littéraire", "Générale"
  capacite        Int      @default(40)
  fraisScolarite  Decimal  @db.Decimal(12, 2) // Spécifique à la classe
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  anneeScolaire AnneeScolaire @relation(fields: [anneeScolaireId], references: [id], onDelete: Cascade)
  
  inscriptions   Inscription[]
  enseignants    EnseignantClasse[]
  evaluations    Evaluation[]
  emploisDuTemps EmploiDuTemps[]
  bulletins      Bulletin[]

  @@unique([tenantId, anneeScolaireId, nom])
  @@index([tenantId])
  @@index([anneeScolaireId])
}

model Matiere {
  id          String   @id @default(uuid())
  tenantId    String
  nom         String   // ex: "Mathématiques", "Histoire-Géographie"
  code        String   // ex: "MATH", "HIST-GEO"
  coefficient Int      @default(1)
  description String?
  actif       Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  evaluations    Evaluation[]
  emploisDuTemps EmploiDuTemps[]

  @@unique([tenantId, code])
  @@index([tenantId])
}

model Eleve {
  id             String    @id @default(uuid())
  tenantId       String
  parentId       String?   // Relation vers le Parent (User) connecté
  matricule      String    @unique // Code unique de l'élève ex: "GS-2026-0089"
  nom            String
  prenom         String
  dateNaissance  DateTime
  lieuNaissance  String?
  sexe           String    // "M" | "F"
  adresse        String?
  photoUrl       String?
  actif          Boolean   @default(true)
  dateEntree     DateTime  @default(now())
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent User?  @relation(fields: [parentId], references: [id], onDelete: SetNull)
  
  inscriptions Inscription[]
  notes        Note[]
  bulletins    Bulletin[]
  absences     Absence[]
  sanctions    Sanction[]

  @@index([tenantId])
  @@index([matricule])
  @@index([nom, prenom])
}

// Table de liaison d'inscriptions annuelles (Équivalent de DossierPatient dans GestSchool)
model Inscription {
  id              String            @id @default(uuid())
  tenantId        String
  eleveId         String
  classeId        String
  anneeScolaireId String
  dateInscription DateTime          @default(now())
  statut          StatutInscription @default(validee)
  soldeScolarite  Decimal           @default(0.00) @db.Decimal(12, 2) // Montant restant à payer
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  eleve         Eleve         @relation(fields: [eleveId], references: [id], onDelete: Cascade)
  classe        Classe        @relation(fields: [classeId], references: [id], onDelete: Cascade)
  anneeScolaire AnneeScolaire @relation(fields: [anneeScolaireId], references: [id], onDelete: Cascade)
  
  paiements Paiement[]

  @@unique([tenantId, anneeScolaireId, eleveId]) // Un élève est inscrit dans une seule classe par an
  @@index([tenantId])
  @@index([eleveId])
  @@index([classeId])
  @@index([anneeScolaireId])
}

model EnseignantClasse {
  id           String @id @default(uuid())
  enseignantId String // Référence à Staff (rôle enseignant)
  classeId     String
  
  enseignant Staff  @relation(fields: [enseignantId], references: [id], onDelete: Cascade)
  classe     Classe @relation(fields: [classeId], references: [id], onDelete: Cascade)

  @@unique([enseignantId, classeId])
}

// Une évaluation : devoir, interrogation, examen, composition
model Evaluation {
  id              String         @id @default(uuid())
  tenantId        String
  classeId        String
  matiereId       String
  anneeScolaireId String
  periodeIndex    Int            // Trimestre 1, 2, 3 ou Semestre 1, 2
  nom             String         // ex: "Devoir de Table n°1"
  type            TypeEvaluation @default(devoir)
  dateEvaluation  DateTime
  coefficient     Int            @default(1)
  noteMaximale    Decimal        @default(20.00) @db.Decimal(5, 2)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  classe        Classe        @relation(fields: [classeId], references: [id], onDelete: Cascade)
  matiere       Matiere       @relation(fields: [matiereId], references: [id], onDelete: Cascade)
  anneeScolaire AnneeScolaire @relation(fields: [anneeScolaireId], references: [id], onDelete: Cascade)
  
  notes Note[]

  @@index([tenantId])
  @@index([classeId, matiereId])
}

model Note {
  id           String   @id @default(uuid())
  eleveId      String
  evaluationId String
  valeur       Decimal  @db.Decimal(5, 2) // La note obtenue (ex: 14.50)
  appreciation String?  // Commentaire de l'enseignant (ex: "Très bon travail")
  saisiParId   String?  // Id de l'enseignant
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  eleve      Eleve      @relation(fields: [eleveId], references: [id], onDelete: Cascade)
  evaluation Evaluation @relation(fields: [evaluationId], references: [id], onDelete: Cascade)

  @@unique([eleveId, evaluationId]) // Un élève a une seule note par évaluation
  @@index([eleveId])
  @@index([evaluationId])
}

// Les bulletins scolaires calculés et archivés (Équivalent de Dossier/Rapport dans GestSchool)
model Bulletin {
  id              String   @id @default(uuid())
  tenantId        String
  eleveId         String
  classeId        String
  anneeScolaireId String
  periodeIndex    Int      // 1 = 1er Trimestre / Semestre
  moyenneGenerale Decimal  @db.Decimal(5, 2)
  rang            Int
  effectifClasse  Int
  decisionConseil String?  // ex: "Passage au niveau supérieur", "Avertissement travail"
  absencesHeures  Int      @default(0)
  notesDetaillees Json     // Structure JSON contenant le détail des moyennes par matière
  pdfUrl          String?  // Copie archivée sur Cloudinary du bulletin généré
  valide          Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  eleve         Eleve         @relation(fields: [eleveId], references: [id], onDelete: Cascade)
  classe        Classe        @relation(fields: [classeId], references: [id], onDelete: Cascade)
  anneeScolaire AnneeScolaire @relation(fields: [anneeScolaireId], references: [id], onDelete: Cascade)

  @@unique([tenantId, anneeScolaireId, classeId, periodeIndex, eleveId])
  @@index([tenantId])
  @@index([eleveId])
}

// Paiement de la scolarité (Équivalent de Vente / PaymentTransaction dans GestSchool)
model Paiement {
  id            String         @id @default(uuid())
  tenantId      String
  inscriptionId String
  recuParId     String         // Comptable / caissier qui a perçu les fonds
  numeroRecu    Int            // Auto-incrémenté par tenant pour l'impression
  montant       Decimal        @db.Decimal(12, 2)
  typePaiement  TypePaiement   @default(scolarite)
  modePaiement  ModePaiement
  reference     String?        // ID de transaction Mobile Money, chèque ou virement
  datePaiement  DateTime       @default(now())
  motif         String?        // ex: "Frais de Scolarité - Tranche 1"
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  inscription Inscription @relation(fields: [inscriptionId], references: [id], onDelete: Cascade)
  recuPar     Staff       @relation("RecuPar", fields: [recuParId], references: [id])

  @@unique([tenantId, numeroRecu])
  @@index([tenantId])
  @@index([inscriptionId])
}

model EmploiDuTemps {
  id           String   @id @default(uuid())
  tenantId     String
  classeId     String
  matiereId    String
  enseignantId String   // Staff (role: enseignant)
  jourSemaine  Int      // 1=Lundi, 2=Mardi... 7=Dimanche
  heureDebut   String   // format "HH:MM" (ex: "08:00")
  heureFin     String   // format "HH:MM" (ex: "10:00")
  salle        String?  // Nom ou numéro de la salle de cours
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant     Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  classe     Classe  @relation(fields: [classeId], references: [id], onDelete: Cascade)
  matiere    Matiere @relation(fields: [matiereId], references: [id], onDelete: Cascade)
  enseignant Staff   @relation(fields: [enseignantId], references: [id], onDelete: Cascade)

  absences Absence[]

  @@index([tenantId])
  @@index([classeId])
  @@index([enseignantId])
}

model Absence {
  id              String   @id @default(uuid())
  tenantId        String
  eleveId         String
  emploiDuTempsId String?  // Lié au cours manqué
  dateAbsence     DateTime @default(now())
  justifiee       Boolean  @default(false)
  motifJustif     String?  // Justification médicale ou parentale
  pieceJustifUrl  String?  // Image d'un mot de médecin ou document justificatif
  saisieParId     String?  // Surveillant ou Enseignant qui a fait l'appel
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant        Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  eleve         Eleve          @relation(fields: [eleveId], references: [id], onDelete: Cascade)
  emploiDuTemps EmploiDuTemps? @relation(fields: [emploiDuTempsId], references: [id], onDelete: SetNull)

  @@index([tenantId])
  @@index([eleveId])
  @@index([dateAbsence])
}

model Sanction {
  id           String       @id @default(uuid())
  tenantId     String
  eleveId      String
  type         TypeSanction
  motif        String
  dureeJours   Int?         // Durée en jours en cas d'exclusion
  dateSanction DateTime     @default(now())
  validee      Boolean      @default(true)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  eleve  Eleve  @relation(fields: [eleveId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([eleveId])
}

model Actualite {
  id        String   @id @default(uuid())
  tenantId  String
  titre     String
  contenu   String   @db.Text
  publique  Boolean  @default(false) // true = visible sur le site vitrine
  photoUrl  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([publique])
}

// ==========================================
// 3. ENUMS SCOLARISE
// ==========================================

enum StaffRole {
  super_admin  // Administrateur système global
  directeur    // Équivalent Directeur : accès total
  secretaire   // Équivalent Gestionnaire / Vendeur : inscriptions, classes
  enseignant   // Équivalent Préparateur : notes, cahier de texte
  surveillant  // Équivalent Livreur/Préparateur : discipline, absences
  comptable    // Équivalent Caissier : encaissements, facturation scolaires
}

enum StatutInscription {
  en_attente
  validee
  annulee
  suspendue
}

enum TypeEvaluation {
  devoir
  interrogation
  examen
  rattrapage
}

enum TypePaiement {
  inscription
  scolarite
  mensualite
  examen_officiel
  bibliotheque
  cantine
  uniforme
  autre
}

enum ModePaiement {
  especes
  mobile_money // Orange Money, MTN MoMo, Airtel Money
  carte
  cheque
  virement
}

enum TypeSanction {
  avertissement
  blame
  retenue
  exclusion_temporaire
  exclusion_definitive
}

// ==========================================
// 4. AUDIT SYSTEM (Identique GestSchool)
// ==========================================

enum AuditAction {
  login
  logout
  staff_created
  staff_updated
  staff_deleted
  tenant_created
  tenant_updated
  eleve_created
  eleve_updated
  inscription_created
  note_saisie
  note_modifiee
  bulletin_genere
  paiement_encaisse
  absence_saisie
  sanction_attribuee
}

model AuditLog {
  id          String      @id @default(uuid())
  tenantId    String?
  actorId     String?     // Staff ID ou User ID
  actorRole   String?
  action      AuditAction
  targetType  String?     // ex: "Eleve", "Note", "Paiement"
  targetId    String?
  details     Json?       // Ancienne valeur, nouvelle valeur
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime    @default(now())

  tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: SetNull)

  @@index([tenantId])
  @@index([action])
  @@index([createdAt])
}
```

---

## ━━━ SECTION 5 — LES ACTEURS DU SYSTÈME ━━━

Chaque acteur interagit avec le système via des permissions isolées, des URL de redirection après connexion et des espaces de travail dédiés.

```
       ┌─────────────────────────────────────────────────────────┐
       │                    ESPACES DE TRAVAIL                   │
       └─────────────────────────────────────────────────────────┘
            │                   │                     │
            ▼                   ▼                     ▼
     [Directeur/Sec/Comp]  [Enseignant]        [Parents / Élèves]
      Espace Admin          Espace Enseignant   Espace Famille
      (/admin/*)            (/enseignant/*)     (/parent/*)
```

### ACTEUR 1 — SUPER ADMIN SYSTEM
*   **Rôle** : `super_admin` (Géré directement sans isolation de tenant, rattaché au tenant système).
*   **Description** : Administrateur de la plateforme SaaS GestSchool globale.
*   **URL de Redirection** : `/super-admin/dashboard`
*   **Pages Accessibles** : Gestion des tenants (écoles), statistiques globales d'activité, plans de facturation SaaS, audits globaux.
*   **Actions Autorisées** : Créer/Désactiver une école, modifier le plan de facturation d'une école, forcer la maintenance globale de la plateforme, visionner l'état technique des serveurs.

### ACTEUR 2 — DIRECTEUR / PROVISEUR
*   **Rôle** : `directeur` (L'équivalent du Directeur dans GestSchool).
*   **Description** : Chef d'établissement avec pouvoir de décision et visibilité complète.
*   **URL de Redirection** : `/admin/dashboard`
*   **Pages Accessibles** : Toutes les pages de l'espace administratif (`/admin/*`), financiers, pédagogiques et de paramétrage.
*   **Actions Autorisées** : Définir les taux de scolarité, configurer l'année scolaire active, gérer le personnel (`Staff`), valider les bulletins, consulter les bilans financiers complexes, configurer la charte graphique de l'école (white-label).

### ACTEUR 3 — SECRÉTAIRE / ADMIN SCOLAIRE
*   **Rôle** : `secretaire` (L'équivalent du profil "Gestionnaire" dans GestSchool).
*   **Description** : Gère l'administration quotidienne des élèves, classes et inscriptions.
*   **URL de Redirection** : `/admin/dashboard`
*   **Pages Accessibles** : `/admin/eleves`, `/admin/classes`, `/admin/inscriptions`, `/admin/emploi-du-temps`, `/admin/actualites`.
*   **Actions Autorisées** : Saisir de nouveaux élèves, valider les dossiers d'inscription, affecter les élèves aux classes, composer les emplois du temps, éditer les listes de classes, publier les actualités de l'école.

### ACTEUR 4 — ENSEIGNANT / PROFESSEUR
*   **Rôle** : `enseignant` (Équivalent du profil "Préparateur" de GestSchool).
*   **Description** : Intervenant pédagogique responsable de ses classes et matières attribuées.
*   **URL de Redirection** : `/enseignant/dashboard`
*   **Pages Accessibles** : `/enseignant/mes-classes`, `/enseignant/evaluations`, `/enseignant/saisie-notes`, `/enseignant/appel` (absences), `/enseignant/mon-emploi-du-temps`.
*   **Actions Autorisées** : Créer une évaluation (devoir/interro) pour ses classes attribuées, saisir/modifier les notes de ses élèves dans sa matière, faire l'appel quotidien (marquer les absences), saisir les appréciations sur les notes.

### ACTEUR 5 — SURVEILLANT / CENSEUR
*   **Rôle** : `surveillant` (Équivalent du profil "Livreur / Vendeur" dans GestSchool).
*   **Description** : Responsable de la discipline générale, de l'assiduité et de l'encadrement des élèves.
*   **URL de Redirection** : `/admin/dashboard`
*   **Pages Accessibles** : `/admin/eleves`, `/admin/absences`, `/admin/sanctions`, `/admin/emploi-du-temps`.
*   **Actions Autorisées** : Enregistrer et valider des absences, contacter ou convoquer les parents, saisir des sanctions disciplinaires (avertissements, exclusions temporaires), modifier les justificatifs d'absences présentés par les familles.

### ACTEUR 6 — COMPTABLE / CAISSIER
*   **Rôle** : `comptable` (Équivalent du profil "Caissier" de GestSchool).
*   **Description** : Responsable de la trésorerie et de la comptabilité interne de l'école.
*   **URL de Redirection** : `/admin/dashboard`
*   **Pages Accessibles** : `/admin/paiements`, `/admin/inscriptions`, `/admin/statistiques-financieres`.
*   **Actions Autorisées** : Encaisser les frais de scolarité et d'inscription, générer et imprimer les reçus numérotés, définir les échéances de paiement des élèves insolvables, lancer les relances automatiques par e-mail/Socket, exporter les rapports de caisse du jour.

### ACTEUR 7 — PARENT D'ÉLÈVE
*   **Rôle** : `parent` (Le "Client connecté" de GestSchool).
*   **Description** : Accède à l'espace famille pour suivre la scolarité de son ou ses enfant(s).
*   **URL de Redirection** : `/parent/dashboard`
*   **Pages Accessibles** : `/parent/mes-enfants`, `/parent/notes`, `/parent/bulletins`, `/parent/absences`, `/parent/sanctions`, `/parent/paiements-factures`.
*   **Actions Autorisées** : Consulter en temps réel les notes et appréciations, visionner et télécharger les bulletins PDF validés par la direction, voir les absences de la semaine et téléverser un justificatif d'absence (ex : certificat médical), consulter l'état financier de la scolarité de l'enfant et initier un paiement mobile money.

---

## ━━━ SECTION 6 — TOUTES LES PAGES (FRONTEND) ━━━

La structure des composants et des routes est rigoureusement alignée sur le design unifié de GestSchool.

```
client/src/pages/
├── public/                # Espace public / Vitrine
│   ├── Home.jsx           # /e/:slug
│   ├── Login.jsx          # /e/:slug/login
│   ├── Register.jsx       # /e/:slug/register
│   ├── Actualites.jsx     # /e/:slug/actualites
│   └── Contact.jsx        # /e/:slug/contact
│
├── admin/                 # Espace Administratif & Financier (/admin/*)
│   ├── Dashboard.jsx      # /admin/dashboard
│   ├── Eleves.jsx         # /admin/eleves
│   ├── Classes.jsx        # /admin/classes
│   ├── Inscriptions.jsx   # /admin/inscriptions
│   ├── Matieres.jsx       # /admin/matieres
│   ├── EmploiDuTemps.jsx  # /admin/emploi-du-temps
│   ├── Absences.jsx       # /admin/absences
│   ├── Sanctions.jsx      # /admin/sanctions
│   ├── Paiements.jsx      # /admin/paiements
│   ├── Bulletins.jsx      # /admin/bulletins
│   ├── Rapports.jsx       # /admin/rapports
│   ├── Personnel.jsx      # /admin/personnel (Gestion Staff)
│   └── Configuration.jsx  # /admin/configuration (White-Label, Modules)
│
├── enseignant/            # Espace Pédagogique (/enseignant/*)
│   ├── Dashboard.jsx      # /enseignant/dashboard
│   ├── Classes.jsx        # /enseignant/mes-classes
│   ├── SaisieNotes.jsx    # /enseignant/mes-classes/:id/notes
│   ├── Appel.jsx          # /enseignant/appel
│   └── MonEmploi.jsx      # /enseignant/mon-emploi
│
├── parent/                # Espace Famille (/parent/*)
│   ├── Dashboard.jsx      # /parent/dashboard
│   ├── MesEnfants.jsx     # /parent/mes-enfants
│   ├── SuiviScolarite.jsx # /parent/mes-enfants/:id/suivi (Notes, Absences)
│   ├── BulletinsTelech.jsx# /parent/mes-enfants/:id/bulletins
│   └── Facturation.jsx    # /parent/facturation
│
└── super-admin/           # Espace Super-Admin (/super-admin/*)
    ├── Dashboard.jsx      # /super-admin/dashboard
    ├── Tenants.jsx        # /super-admin/tenants (Écoles)
    └── Audits.jsx         # /super-admin/audits (Logs techniques globaux)
```

### DÉTAIL DES PAGES ET ROUTES CENTRALES

#### PAGES PUBLIQUES (Layout Épuré public, `/e/:slug/*`)
*   `Home.jsx` ──► `/e/:slug`  
    *Description* : Site vitrine de l'école résolue par le slug. Affiche la présentation de l'école, l'adresse, le mot de bienvenue du directeur et les 3 dernières actualités publiques.
*   `Login.jsx` ──► `/e/:slug/login`  
    *Description* : Formulaire de connexion universel (Staff, Enseignants, Parents). Redirige dynamiquement selon le rôle.
*   `Register.jsx` ──► `/e/:slug/register`  
    *Description* : Formulaire d'auto-inscription pour les nouveaux parents d'élèves (création du compte utilisateur `User` lié à l'école).

#### PAGES ADMINISTRATIVES (`AdminLayout.jsx`, `/admin/*`)
*   `Dashboard.jsx` ──► `/admin/dashboard`  
    *Description* : Tableau de bord de l'école. Pour le Directeur : KPIs financiers (recettes scolarité du mois, taux d'impayés), effectifs totaux (élèves inscrits, enseignants actifs), taux de présence global du jour et graphique Recharts de répartition des élèves par classe.
*   `Eleves.jsx` ──► `/admin/eleves`  
    *Description* : Annuaire complet des élèves. Recherche globale avancée, filtre par niveau, genre et statut actif. Fiche élève complète avec historique disciplinaire (`Sanction`), médicale, dossier d'inscription et profil des parents.
*   `Inscriptions.jsx` ──► `/admin/inscriptions`  
    *Description* : Gestion des dossiers d'inscriptions annuels. Saisie et validation des réinscriptions d'une année sur l'autre, suivi du solde restant à payer sur la scolarité.
*   `Paiements.jsx` ──► `/admin/paiements`  
    *Description* : Caisse de l'école. Enregistrement des paiements (espèces, mobile money). Impression instantanée du reçu PDFKit numéroté.
*   `Bulletins.jsx` ──► `/admin/bulletins`  
    *Description* : Moteur de génération de bulletins. Permet de déclencher le calcul des moyennes de la classe pour un trimestre, génère les bulletins PDF archivés sur Cloudinary et les valide pour diffusion instantanée sur l'espace parents.
*   `Configuration.jsx` ──► `/admin/configuration`  
    *Description* : Réservé au Directeur. Activation des 12 modules, configuration de la charte graphique de l'école (palette, logo, favicon), paramétrage des horaires et jours de cours, définition de l'année scolaire active.

---

## ━━━ SECTION 7 — LES 12 MODULES SAAS ━━━

GestSchool V1 implémente un système de modules applicatifs activables/désactivables à la volée depuis l'espace `/admin/configuration` (stockés en base dans `TenantConfig`). Le frontend et le backend s'adaptent instantanément pour masquer ou bloquer l'accès aux modules désactivés.

| Module | Défaut | Effet si activé (ON) | Effet si désactivé (OFF) |
| :--- | :--- | :--- | :--- |
| **moduleNotes** | `ON` | Saisie des notes par les enseignants, calcul des moyennes en temps réel. | Module de base indispensable, ne peut pas être désactivé en production. |
| **moduleBulletins** | `ON` | Bouton "Générer Bulletins", calcul des rangs de classe, impression des livrets scolaires PDF. | Pas de bulletins archivés ; les notes restent consultables individuellement. |
| **modulePresences** | `ON` | Appel journalier par l'enseignant, gestion des absences par le surveillant, alertes parents. | Aucune saisie d'absences, suppression de l'onglet assiduité. |
| **modulePaiements** | `ON` | Comptabilité de scolarité, encaissement, impression reçus, relances d'impayés et alertes Socket. | L'école gère sa comptabilité hors-ligne, suppression du module de caisse. |
| **moduleEmploiDuTemps** | `ON` | Grille d'emploi du temps interactive par classe et prof, détection des conflits de salle/prof. | Pas d'emploi du temps visible, cours non programmés. |
| **moduleParents** | `ON` | Ouverture de l'espace parent connecté (`/parent/*`) avec création de compte parents. | Pas d'accès parent direct, communication uniquement par e-mail/physique. |
| **moduleEleves** | `OFF` | Ouverture d'un espace sécurisé en lecture seule pour les élèves de niveau supérieur (Lycée). | Les élèves n'ont pas de comptes de connexion propres. |
| **moduleSanctions** | `ON` | Saisie des sanctions disciplinaires (avertissements, blâmes) par le censeur ou directeur. | Masquage du dossier disciplinaire, pas d'alertes sanctions aux familles. |
| **moduleBiblio** | `OFF` | Catalogue de la bibliothèque scolaire, gestion des emprunts et retours de livres. | Masquage complet du module de gestion de bibliothèque. |
| **moduleCantine** | `OFF` | Inscription à la demi-pension, menus de la semaine, facturation et paiements repas. | Aucune gestion de cantine. |
| **moduleTransport** | `OFF` | Gestion des lignes de bus scolaire, affectation des élèves par bus, suivi des paiements transport. | Pas de gestion de transport. |
| **moduleCertificats** | `ON` | Impression automatique en un clic de documents officiels (Certificat de scolarité, inscription). | Documents administratifs rédigés manuellement par le secrétariat. |

*Note sur l'adaptation backend* : Le décorateur `requireModule` est appliqué au niveau des routeurs Express de la même façon que dans GestSchool.

---

## ━━━ SECTION 8 — WHITE-LABEL (PERSONNALISATION) ━━━

Chaque établissement peut s'approprier l'interface pour correspondre à son identité de marque et à sa législation locale.

### VARIABLES PERSONNALISABLES
*   **Couleurs Thématiques** : Appliquées dynamiquement par le `TenantProvider` lors du chargement de l'application via des variables CSS injectées sur `:root` :
    *   `--color-primary` : Couleur dominante de la sidebar administrative, des boutons d'actions et des liens actifs.
    *   `--color-secondary` : Utilisée pour les badges de succès, les états validés et les KPIs.
*   **Police de Caractères** : Configurable parmi un set de polices classiques (Plus Jakarta Sans, Inter, Roboto, Montserrat).
*   **Détails Identitaires** : Nom officiel (ex : "Lycée Savorgnan de Brazza"), Logo d'en-tête (utilisé dans la Sidebar et sur les Bulletins PDF), Favicon personnalisé, Slogan de l'école.
*   **Devise Locale** : Configurable (FCFA, GNF, CDF, USD, EUR) pour s'adapter à toutes les zones d'Afrique francophone.

### PALETTES RECOMMANDÉES POUR LES ÉCOLES
Pour aider les établissements à configurer leur progiciel, 6 palettes élégantes pré-établies sont proposées dans l'interface d'administration :

1.  **Classic Academic (Bleu Marine & Or)** :  
    `couleurPrimaire: "#1e3a8a"` (Navy Blue) \| `couleurSecondaire: "#d4af37"` (Gold)  
    *Idéal pour* : Établissements secondaires historiques et lycées d'excellence.
2.  **Forest School (Vert Émeraude & Sauge)** :  
    `couleurPrimaire: "#065f46"` (Emerald Green) \| `couleurSecondaire: "#0f766e"` (Sage)  
    *Idéal pour* : Écoles de niveau primaire privilégiant l'écologie ou la proximité.
3.  **Bordeaux Prestige (Burgundy & Slate)** :  
    `couleurPrimaire: "#881337"` (Burgundy) \| `couleurSecondaire: "#475569"` (Slate Grey)  
    *Idéal pour* : Établissements privés haut de gamme.
4.  **Modern Indigo (Violet Indigo & Corail)** :  
    `couleurPrimaire: "#4f46e5"` (Indigo) \| `couleurSecondaire: "#f97316"` (Coral)  
    *Idéal pour* : Écoles internationales et technologiques.
5.  **Royal Blue (Bleu Roi & Cyan)** :  
    `couleurPrimaire: "#1d4ed8"` (Royal Blue) \| `couleurSecondaire: "#06b6d4"` (Cyan)  
    *Idéal pour* : Collèges et complexes scolaires polyvalents.
6.  **Corporate Ochre (Ocre Africain & Terre Noire)** :  
    `couleurPrimaire: "#c2410c"` (Terracotta) \| `couleurSecondaire: "#1f2937"` (Dark Earth)  
    *Idéal pour* : Écoles mettant en valeur l'identité culturelle locale.

---

## ━━━ SECTION 9 — LOGIQUE MÉTIER CLÉS (ALGORITHMES) ━━━

### A) CALCUL DE MOYENNE (Matière & Générale)
Le calcul s'effectue dans une transaction Prisma et suit le modèle officiel des Ministères de l'Éducation Nationale francophones :

1.  **Calcul de la Moyenne d'un Élève par Matière sur une Période ($M_{eleve, matiere}$)** :
    $$M_{eleve, matiere} = \frac{\sum_{i=1}^{n} (Note_i \times CoefEvaluation_i)}{\sum_{i=1}^{n} CoefEvaluation_i}$$
    *(Où $Note_i$ est la note ramenée sur la base commune, par exemple sur 20).*
2.  **Calcul de la Moyenne Générale de l'Élève ($MG_{eleve}$)** :
    $$MG_{eleve} = \frac{\sum_{j=1}^{m} (M_{eleve, matiere_j} \times CoefMatiere_j)}{\sum_{j=1}^{m} CoefMatiere_j}$$
3.  **Détermination du Rang dans la Classe ($Rang$)** :
    *   Le système classe toutes les $MG_{eleve}$ de la classe par ordre décroissant.
    *   En cas d'égalité exacte (ex : deux élèves avec 14.50/20), ils reçoivent le même rang (ex : $3^{\text{ème}}$ ex æquo) et le rang suivant est sauté (ex : l'élève suivant est classé $5^{\text{ème}}$).

### B) GÉNÉRATION DE BULLETIN (PDFKit)
Le document PDF produit doit être irréprochable et infalsifiable.

```
┌────────────────────────────────────────────────────────┐
│  [LOGO ÉCOLE]   BULLETIN DE NOTES - T1   [ANNÉE SCOLAIRE]│
│  Lycée Mbandza  Élève : David MVOUBA     Classe : 6ème A│
├────────────────────────────────────────────────────────┤
│ Matière        Coef   Moy.Élève   Moy.Classe  Appréciat.│
├────────────────────────────────────────────────────────┤
│ MATHÉMATIQUES    4      15.50       11.20     Très bon  │
│ FRANÇAIS         3      12.00       10.50     En progrès│
│ ...                                                    │
├────────────────────────────────────────────────────────┤
│ MOYENNE GÉNÉRALE : 14.25/20  RANG : 3ème/42  ASSERMENTÉ│
│ Absences : 2 heures (dont 0 non-justifiées)            │
│ Avis du conseil : Félicitations du conseil             │
├────────────────────────────────────────────────────────┤
│ [QR CODE VERIF]                [SIGNATURE DU DIRECTEUR]│
└────────────────────────────────────────────────────────┘
```
1.  **En-tête officiel** : Logo de l'établissement, informations sur l'élève (nom, prénom, matricule), classe, effectif de la classe, année scolaire, et libellé de la période (ex : 1er Trimestre).
2.  **Tableau des notes** : Matière, coefficient, moyenne obtenue par l'élève, moyenne minimale, maximale et moyenne générale de la classe dans cette matière pour comparaison, appréciation de l'enseignant.
3.  **Récapitulatif de période** : Moyenne générale, rang officiel, assiduité (heures d'absences justifiées et non-justifiées), mention honorifique attribuée par le conseil des professeurs (Félicitations, Tableau d'honneur, Encouragements, Avertissement conduite/travail).
4.  **Securité (Anti-Fraude)** : Un QR Code unique est imprimé en bas à gauche du bulletin. Ce QR Code contient une URL sécurisée pointant vers le serveur API (`https://api.gestschool.com/public/bulletins/verify/:id`). Un parent d'élève ou une autorité administrative peut scanner ce QR Code pour afficher instantanément la version officielle hébergée en ligne, rendant toute tentative de falsification papier obsolète.

### C) COMPTABILITÉ ET SUIVI DES PAIEMENTS
Pour pallier le risque d'impayés, fléau majeur des écoles privées africaines, le système met en place un moteur financier hautement paramétrable.
1.  **Frais obligatoires annuels** : Frais d'inscription (payables une fois à l'inscription) + Frais de scolarité globale de l'année (calculés par Classe, divisés en $N$ tranches configurables).
2.  **Calcul du solde en temps réel** :
    $$\text{Solde restant} = \text{Frais Inscription} + \text{Scolarité Annuelle} - \sum \text{Montants Paiements Validés}$$
3.  **Échéancier strict** : Chaque tranche possède une date limite (ex : Tranche 1 avant le 1er Octobre, Tranche 2 avant le 1er Janvier).
4.  **Verrou de scolarité (Algorithme d'exclusion financière soft)** : Si un élève dépasse la date d'échéance de plus de 15 jours sans paiement enregistré, le système génère une alerte temps réel visible sur l'espace parent et envoie un e-mail de mise en demeure. L'élève est marqué comme "Débiteur en retard".

### D) EMPLOI DU TEMPS ET DÉTECTION DE CONFLITS
L'algorithme de composition de l'emploi du temps vérifie les 3 règles d'or d'exclusion d'intersection lors de la création d'un créneau horaire (Cours $C_{nouveau}$ pour le Professeur $P$, dans la Salle $S$, pour la Classe $K$) :
1.  **Règle du Professeur Unique** : Le professeur $P$ ne doit pas avoir un autre cours déjà planifié sur la même plage horaire pour un autre groupe :
    $$\text{Cours}(P) \cap C_{nouveau} = \emptyset$$
2.  **Règle de la Salle Unique** : La salle de classe $S$ ne doit pas être occupée par un autre enseignant pour une autre classe sur ce créneau :
    $$\text{Salle}(S) \cap C_{nouveau} = \emptyset$$
3.  **Règle de la Classe Unique** : La classe $K$ ne doit pas avoir un autre cours programmé en même temps dans une autre matière :
    $$\text{Classe}(K) \cap C_{nouveau} = \emptyset$$
*Implémentation technique* : Exécution d'une requête SQL avec clause `EXISTS` et verrous de base de données pour empêcher les conflits en cas de programmation simultanée par deux secrétaires.

---

## ━━━ SECTION 10 — TEMPS RÉEL (SOCKET.IO) ━━━

Socket.IO maintient une connexion active entre les utilisateurs connectés et le serveur pour une interactivité instantanée.

### ARCHITECTURE DES SALLES (ROOMS)
Lors du handshake Socket.IO, l'utilisateur est authentifié via son token JWT. Son socket rejoint automatiquement les salles correspondant à son périmètre d'action :
*   **Salle Établissement (Staff)** : `ecole-{slug}-staff`  
    *Membres* : Tout le personnel de l'école (Directeur, secrétaire, comptable, surveillant, profs).
*   **Salle Parent (User)** : `parent-{userId}`  
    *Membres* : Le parent connecté. Permet de cibler précisément un foyer.
*   **Salle Classe (Élève)** : `classe-{classeId}`  
    *Membres* : Les enseignants et les élèves de la classe concernée.

### ÉVÉNEMENTS DU SYSTÈME (EVENTS)

#### 1. Saisie d'une nouvelle note (`nouvelleNote`)
*   *Déclencheur* : Enseignant valide la saisie d'un devoir.
*   *Destinataires* : Salles `parent-{userId}` de tous les parents des élèves de la classe.
*   *Payload* : `{ eleveNom: "David", matiere: "Physique-Chimie", note: "16.5/20", appreciation: "Excellent devoir !" }`
*   *Effet UI* : Un toast s'affiche instantanément sur le téléphone/ordinateur du parent : *"David a reçu sa note de Physique-Chimie : 16.5/20"* et incrémente l'icône de notification.

#### 2. Signalement d'une absence non-justifiée (`nouvelleAbsence`)
*   *Déclencheur* : L'enseignant fait l'appel en début de cours.
*   *Destinataires* : Salle `parent-{userId}` du parent de l'élève absent.
*   *Payload* : `{ eleveNom: "Marie", heure: "08:15", cours: "Mathématiques" }`
*   *Effet UI* : Toast rouge vibrant sur l'espace parent : *"Alerte absence : Marie a été signalée absente au cours de Mathématiques ce matin à 08:15. Veuillez contacter le surveillant."*

#### 3. Notification de Sanction (`nouvelleSanction`)
*   *Déclencheur* : Le Censeur valide l'enregistrement d'une sanction.
*   *Destinataires* : Salle `parent-{userId}`.
*   *Payload* : `{ eleveNom: "Lucas", type: "avertissement", motif: "Bavardages répétés et insolence envers l'enseignant" }`
*   *Effet UI* : Alerte disciplinaire immédiate sur l'espace parent.

#### 4. Relance de Paiement Échue (`paiementEchu`)
*   *Déclencheur* : Batch de nuit de l'API détectant les échéances dépassées, ou action manuelle du comptable.
*   *Destinataires* : Salles `parent-{userId}` des parents débiteurs.
*   *Payload* : `{ montant: "45 000 FCFA", echeance: "15 Mars", tranche: "Tranche 2" }`
*   *Effet UI* : Notification financière persistante avec bouton d'action directe vers la page de paiement en ligne.

#### 5. Publication d'une Actualité (`actualitePubliee`)
*   *Déclencheur* : Le secrétariat publie un message important d'intérêt général.
*   *Destinataires* : `ecole-{slug}-staff` et tous les parents connectés.
*   *Payload* : `{ titre: "Convocation Assemblée Générale des Parents", date: "29 Juin" }`

### FICHIER CENTRAL DE SERVICE : `server/utils/schoolEvents.js`
Ce fichier centralise l'émission de tous les événements temps réel de l'application, héritant directement de `schoolEvents.js` en l'adaptant au vocabulaire scolaire.

---

## ━━━ SECTION 11 — AUTHENTIFICATION JWT ━━━

GestSchool V1 implémente un système d'authentification robuste inspiré des meilleures pratiques de sécurité bancaire et hérité de GestSchool.

```
                  ┌───────────────────────────────┐
                  │      FORMULAIRE DE LOGIN      │
                  │   /e/mbandza-scolaire/login   │
                  └───────────────────────────────┘
                                  │  (Saisie Email / Pass)
                                  ▼
                     [Vérification BcryptHash]
                                  │
                  ┌───────────────┴───────────────┐
                  │  Identifiants Corrects ?      │
                  └───────────────────────────────┘
                     │ (Oui)                   │ (Non)
                     ▼                         ▼
         [mustChangePassword == true ?]    [Incrémentation Rate Limit]
          │ (Oui)             │ (Non)      [Rejet 401 après 10 échecs]
          ▼                   ▼
     [Redirect           [Génération Tokens]
    /changer-mdp]         - AccessToken (Cookie HttpOnly, 15min)
                          - RefreshToken (Cookie HttpOnly, 7j + DB)
                              │
                              ▼
                         [Redirect
                    Espace Utilisateur]
```

### PROPRIÉTÉS CLÉS DE LA SÉCURITÉ JWT
1.  **Dual Token Flow (Double Token)** :
    *   **AccessToken** : Durée de vie ultra-courte de 15 minutes. Signé avec une clé forte `JWT_SECRET`. Contient le rôle, l'ID de l'utilisateur, et le `tenantId`. Stocké dans un Cookie sécurisé `HttpOnly` (`SameSite=Strict`, `Secure` en production).
    *   **RefreshToken** : Durée de vie de 7 jours. Stocké à la fois en base de données PostgreSQL dans la table `RefreshToken` et dans un Cookie `HttpOnly` dédié `/api/auth/refresh`. Permet d'obtenir un nouvel AccessToken sans forcer l'utilisateur à ressaisir ses identifiants.
2.  **Rotation Automatique des Refresh Tokens (RTR - Refresh Token Rotation)** :  
    Chaque fois que l'AccessToken expire et qu'une demande de rafraîchissement est émise, l'ancien RefreshToken est révoqué et détruit en base, et un nouveau couple Access/Refresh est généré. Si un RefreshToken obsolète ou déjà utilisé est présenté, cela est considéré comme une tentative d'interception : la session entière est invalidée en base de données, déconnectant instantanément tous les terminaux de cet utilisateur.
3.  **Guard de changement de mot de passe obligatoire (`mustChangePassword`)** :  
    Lorsqu'un directeur crée un compte pour un nouvel Enseignant ou Secrétaire, le système génère un mot de passe temporaire complexe et marque `mustChangePassword: true` dans la table `Staff`. Tant que cet indicateur est à `true`, tous les appels d'API (sauf la route `/api/auth/change-password`) sont bloqués par l'intercepteur backend, et le frontend redirige impérativement l'utilisateur vers la page `/changer-mot-de-passe`.
4.  **Protection Anti-BruteForce et Rate Limiting** :  
    Intégration d'un middleware limitateur d'appels Express sur les routes sensibles d'authentification (`/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`). Limitation stricte à **10 tentatives maximum par tranche de 15 minutes** par adresse IP. En cas d'attaques distribuées, blocage ciblé au niveau applicatif.

---

## ━━━ SECTION 12 — API ROUTES (BACKEND ENDPOINTS) ━━━

Les contrôleurs et endpoints Express sont groupés par domaine métier. La résolution multi-tenant et la sécurité d'authentification sont injectées de manière systématique.

### ROUTES PUBLIQUES (Pas de validation JWT de session, `tenantMiddleware` uniquement)
*   `GET /api/config/:slug` ──► Récupère la charte graphique et la configuration active de l'école (favicon, couleurs, modules activés) pour le site vitrine.
*   `POST /api/auth/login` ──► Formulaire d'identification. Retourne les cookies sécurisés.
*   `POST /api/auth/register` ──► Inscription d'un nouveau Parent d'élève (crée un compte `User` inactif en attente de liaison).
*   `GET /api/public/actualites` ──► Liste des actualités publiques et annonces officielles de l'école pour le site vitrine.
*   `GET /api/public/bulletins/verify/:id` ──► Route publique appelée par le QR Code pour valider l'authenticité d'un bulletin de notes papier.

### ESPACE ADMINISTRATIF (`authenticate`, `requireRole('directeur', 'secretaire')`, `requireTenantMatch`)
*   **Élèves** :
    *   `GET /api/eleves` ──► Liste globale filtrée et paginée des élèves.
    *   `POST /api/eleves` ──► Création d'une fiche élève (génère automatiquement un matricule séquentiel unique).
    *   `PUT /api/eleves/:id` ──► Modification des informations administratives d'un élève.
    *   `DELETE /api/eleves/:id` ──► Suppression logique (archivage) d'un élève.
*   **Inscriptions** :
    *   `POST /api/inscriptions` ──► Inscrire un élève dans une classe pour l'année scolaire en cours.
    *   `PUT /api/inscriptions/:id/statut` ──► Suspendre ou radier l'inscription d'un élève.
*   **Schedules & Classes** :
    *   `POST /api/classes` ──► Création d'une classe (nom, niveau, capacité, frais).
    *   `POST /api/emploi-du-temps` ──► Planifier un cours régulier (Vérification préalable des conflits prof/classe/salle).

### ESPACE COMPTABILITÉ (`authenticate`, `requireRole('directeur', 'comptable')`, `requireTenantMatch`)
*   `GET /api/paiements` ──► Visualisation de l'historique des encaissements de l'établissement.
*   `POST /api/paiements` ──► Saisie d'un encaissement (frais de scolarité/inscription). Enregistre la transaction en base, déduit le montant du solde d'inscription, génère le reçu PDFKit numéroté, et émet un événement Socket temps réel vers le parent.
*   `GET /api/statistiques/financieres` ──► Rapports financiers complexes, chiffre d'affaires prévisionnel vs réel, taux d'impayés par classe.

### ESPACE ENSEIGNEMENT (`authenticate`, `requireRole('directeur', 'enseignant')`, `requireTenantMatch`)
*   `GET /api/enseignant/mes-classes` ──► Liste des classes et matières attribuées à l'enseignant connecté.
*   `POST /api/evaluations` ──► Création d'un devoir ou examen (déclare la date, la matière, le coefficient).
*   `POST /api/notes` ──► Saisie en masse de notes pour une évaluation spécifique (utilisant un verrou d'accès concurrentiel).
*   `PUT /api/notes/:id` ──► Modification d'une note déjà saisie (enregistre un log d'audit détaillé pour traçabilité).

### ESPACE FAMILLE (`authenticate`, `requireRole('parent')`, `requireTenantMatch`)
*   `GET /api/parent/mes-enfants` ──► Liste des élèves liés au compte parent connecté.
*   `GET /api/parent/mes-enfants/:id/notes` ──► Bulletin de notes intermédiaire en temps réel de l'enfant ciblé.
*   `GET /api/parent/mes-enfants/:id/absences` ──► Historique des absences avec bouton de chargement de pièce jointe justificative.
*   `GET /api/parent/mes-enfants/:id/bulletins` ──► Accès au téléchargement des bulletins PDF périodiques officiels validés.
*   `GET /api/parent/facturation` ──► Situation financière du foyer, tranches payées et restants à solder.

---

## ━━━ SECTION 13 — SÉCURITÉ ET QUALITÉ ━━━

GestSchool V1 applique un niveau d'exigence de niveau industriel pour assurer l'intégrité de la plateforme.

### SÉCURITÉ LOGIQUE & ACCÈS CONCURRENTS
*   **Concurrence lors de la saisie des notes (Pessimistic Locking)** :  
    En fin de trimestre, plusieurs enseignants peuvent tenter de saisir ou de modifier simultanément des notes pour la même matière ou des matières différentes. Pour éviter les incohérences de base de données, le système utilise l'isolation de transaction PostgreSQL `SELECT FOR UPDATE` au niveau des requêtes Prisma sensibles, bloquant temporairement la lecture/écriture sur les lignes d'évaluation le temps que la transaction en cours se termine proprement.
*   **Intégrité Financière (Transactions ACID)** :  
    L'encaissement d'un frais de scolarité doit être atomique : la création de la ligne `Paiement` et la déduction automatique du montant dans la table `Inscription` s'effectuent au sein d'une transaction Prisma transactionnelle stricte (`prisma.$transaction`). Si l'une des écritures échoue, l'opération entière est annulée (rollback), évitant tout écart de caisse fantôme.
*   **Politique de Sécurité du Contenu (CSP - Content Security Policy)** :  
    Intégration d'un en-tête CSP extrêmement restrictif via Helmet : interdiction stricte de l'injection de scripts inline (aucun `'unsafe-inline'` n'est toléré en production), limitation absolue des connexions sortantes vers les domaines autorisés (notre API, Sentry, et Cloudinary pour les ressources médias), et forçage du protocole HTTPS sécurisé (`upgrade-insecure-requests`).

### AUDITABILITÉ ET TRAÇABILITÉ DES NOTES (Anti-Corruption)
Pour empêcher toute tentative de manipulation des notes (par exemple, un secrétaire ou enseignant modifiant frauduleusement une note après délibération) :
*   Toute opération de création, modification ou suppression d'une note fait l'objet d'un enregistrement automatique et obligatoire dans la table `AuditLog` via l'extension de requête Prisma globale.
*   Le log d'audit enregistre l'identité exacte de l'acteur (`actorId`), l'adresse IP d'origine, la date précise, la valeur de la note avant modification et la nouvelle valeur enregistrée. Ces logs d'audit sont non-modifiables et non-supprimables, même par le Directeur (seul le Super Admin possède un droit de lecture pure de la table d'audit globale).

---

## ━━━ SECTION 14 — TESTS ET CI/CD ━━━

La qualité du code et la résilience aux fortes charges sont testées automatiquement à chaque push sur la branche principale de développement.

```
 GitHub Push ──► [Job 1: Tests Backend] ──► [Job 2: Build Frontend] ──► [Job 3: E2E Playwright] ──► Déploiement Auto
```

### STRATÉGIE DE TEST AUTOMATISÉE
1.  **Tests Unitaires (Vitest)** :  
    Validation des algorithmes critiques de manière isolée.
    *   *Test de calcul de moyenne* : Fournir un jeu de données de 15 notes avec coefficients variables et s'assurer que la moyenne calculée renvoie un résultat mathématiquement rigoureux au centième près.
    *   *Test de détection de conflits horaires* : Simuler la réservation d'un enseignant sur un créneau horaire identique et valider que l'insertion d'un second cours lève une exception applicative maîtrisée.
2.  **Tests d'Intégration (Vitest + Supertest)** :  
    Simulation de requêtes HTTP réelles sur un serveur Express temporaire connecté à une base de données de test PostgreSQL jetable.
    *   *Test du flux d'inscription* : Création d'un élève -> Liaison de dossier d'inscription -> Validation financière.
    *   *Test du flux d'authentification* : Tentatives de brute force -> Blocage d'IP par le Rate Limiter après 10 échecs.
3.  **Tests Bout-en-Bout (Playwright E2E)** :  
    Simulation de scénarios utilisateurs complets dans un navigateur Chromium sans tête.
    *   *Scénario Parents* : Le parent d'élève se connecte, navigue vers la page de ses enfants, vérifie la note affichée à l'écran, clique sur "Télécharger le bulletin", et vérifie que le PDF généré s'ouvre sans erreur.
4.  **Tests de Performance & Charge (k6)** :  
    Vérification de la scalabilité de l'API en simulant des pics de connexions massives (par exemple, à 18h00 le jour de la publication des bulletins scolaires).
    *   *Scénario k6* : Simulation de 100 parents d'élèves connectés simultanément effectuant des requêtes concurrentes sur l'API `/api/parent/mes-enfants/:id/notes` pendant 2 minutes. L'API doit maintenir un temps de réponse moyen inférieur à **200ms** et un taux d'erreur de **0%**.

---

## ━━━ SECTION 15 — DÉPLOIEMENT (INFRASTRUCTURE) ━━━

GestSchool V1 est conçu pour être déployé en un clic sur des infrastructures cloud modernes et à coût maîtrisé (modèle PaaS / Serverless).

### SCHÉMA D'INFRASTRUCTURE DE PRODUCTION
```
                             ┌──────────────────────────────────────┐
                             │       SITE VITRINE & CLIENT APP      │
                             │            Vercel CDN                │
                             │      gestschool.vercel.app           │
                             └──────────────────────────────────────┘
                                                 │
                                                 │ (Appels API HTTPS / WebSockets)
                                                 ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                       CLOUDFLARE WAF                                      │
│                            (Protection DDOS, SSL Strict, DNS)                             │
└───────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
                             ┌──────────────────────────────────────┐
                             │             API BACKEND              │
                             │            Render Web Service        │
                             │     gestschool-api.onrender.com     │
                             │       (Serveur Node.js Docker)       │
                             └──────────────────────────────────────┘
                                      │                  │
               ┌──────────────────────┘                  └──────────────────────┐
               ▼                                                                ▼
┌──────────────────────────────┐                                ┌──────────────────────────────┐
│       BASE DE DONNÉES        │                                │      STOCKAGE DE MÉDIAS      │
│      Render PostgreSQL       │                                │          Cloudinary          │
│       Région Francfort       │                                │  (Photos, Bulletins, Docs)   │
└──────────────────────────────┘                                └──────────────────────────────┘
```

### PROPRIÉTÉS DES SERVICES DE DÉPLOIEMENT
*   **Hébergement Frontend (Vercel)** :  
    Héberge l'application cliente Single Page Application (SPA). Vercel distribue le code compilé à travers un CDN mondial ultra-rapide.  
    *Root Directory* : `client` \| *Build Command* : `npm run build` \| *Output Directory* : `dist`.
*   **Hébergement Backend API (Render.com)** :  
    Exécute le serveur Express à l'intérieur d'un conteneur Docker optimisé (`server/Dockerfile`). Déployé sur la région `frankfurt` (Francfort, Allemagne) pour sa proximité géographique avec l'Afrique et sa conformité stricte RGPD.  
    *Web Service Type* : Docker \| *Plan* : Starter / Pro \| *Health Check Path* : `/api/health`.
*   **Hébergement Base de données (Render PostgreSQL)** :  
    Base PostgreSQL managée avec sauvegardes quotidiennes automatiques et conservation sur 7 jours.
*   **Service de Médias (Cloudinary)** :  
    Utilisé pour le stockage persistant des images de profils des élèves, des logos des écoles de l'espace white-label, et de l'archivage sécurisé des bulletins scolaires générés au format PDF. Le backend utilise le SDK Cloudinary pour téléverser et récupérer les fichiers de manière transparente.

---

## ━━━ SECTION 16 — ROADMAP ARCHITECTURALE V1 ──► V2 ━━━

Le développement de GestSchool V1 pose des bases de données et d'authentification saines et ultra-robustes. La suite du projet (V2) étendra l'écosystème numérique autour de l'école :

### ÉTAPE 1 — FINALISATION V1 (Ce Briefing)
*   **Cœur de Système** : Inscriptions, classes, affectations pédagogiques, gestion du personnel.
*   **Moteur d'Évaluation** : Saisie des notes, calcul des moyennes complexes, édition des appréciations.
*   **Impression et Archivage** : Rendu des bulletins trimestriels PDFKit, génération des reçus financiers de caisse.
*   **Suivi à distance** : Ouverture de l'espace Parents connecté en temps réel pour la consultation des notes, absences, sanctions et échéances financières.

### ÉTAPE 2 — MODERNISATION ET MOBILITÉ (Roadmap V2)
*   **Application Mobile Native (React Native)** :  
    Création d'une application mobile unifiée disponible sur Android (marché ultra-majoritaire en Afrique) et iOS pour les parents et élèves. Intégration des notifications push natives pour remplacer avantageusement les notifications Socket.IO et e-mails lorsque l'application est fermée.
*   **Intégration d'un Passerelle SMS Locale (Twilio / Africa's Talking)** :  
    Envoi automatique de SMS instantanés aux parents lors du signalement d'une absence non-justifiée par l'enseignant, ou pour la relance des impayés de scolarité. Le SMS reste le canal de communication au taux d'ouverture le plus élevé (98%) dans les zones de connectivité internet modérée.
*   **Badge Éleve avec QR Code NFC** :  
    Génération et impression automatique de cartes scolaires plastifiées intégrant un QR Code unique pour chaque élève. À l'entrée de l'établissement, un surveillant muni d'une tablette ou d'un lecteur de badge scanne la carte : l'élève est instantanément marqué présent, et le parent reçoit une alerte silencieuse de sécurité l'informant que son enfant est bien arrivé à l'école.
*   **Dématérialisation et Bibliothèque Numérique** :  
    Module de mise à disposition de ressources pédagogiques (cours PDF, exercices, devoirs de révision) téléchargeables par les élèves à distance.
