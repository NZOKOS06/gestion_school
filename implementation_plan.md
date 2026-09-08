# Plan Stratégique & Technique : De l'Immunisation à la Croissance Exponentielle (2026-2028)

## Vision et But
Transformer les 5 faiblesses mortelles identifiées dans le prémortem en **4 barrières à l'entrée infranchissables pour la concurrence** et en **moteur de croissance exponentielle (Flywheel)** pour GestSchool en Afrique centrale et francophone.

---

## Architecture Cible : Les 4 Piliers Inaltérables

```mermaid
graph TD
    subgraph "Pilier 1 : Résilience Technique & Async"
        P1A[Worker Async pour Bulletins & Rapports]
        P1B[Offline-First IndexedDB Caisse & Appel]
        P1C[Row-Level Security & Isolation DB Absolue]
    end
    
    subgraph "Pilier 2 : Forteresse Financière Caisse"
        P2A[Sessions de Caisse Ouvertes/Fermées]
        P2B[Billetterie Physique & Rapprochement Automatique]
        P2C[Journal d'Audit Immuable Anti-Fraude]
    end
    
    subgraph "Pilier 3 : Ergonomie Terrain 'Zéro-Friction'"
        P3A[Saisie Notes Matricielle Rapide + Auto-Save]
        P3B[Import/Export Excel Bidirectionnel Hors-ligne]
        P3C[Bulletins 100% Homologués Ministères]
    end
    
    subgraph "Pilier 4 : Flywheel de Croissance Exponentielle"
        P4A[Facturation indexée sur la Rentrée Septembre]
        P4B[Cartes Scolaires QR Code Sécurisées]
        P4C[Portail Parents & Relances WhatsApp/SMS]
    end

    Pilier 1 --> Croissance[Leader Incontesté SaaS Éducatif 2028]
    Pilier 2 --> Croissance
    Pilier 3 --> Croissance
    Pilier 4 --> Croissance
```

---

## User Review Required

> [!IMPORTANT]
> **Priorité d'exécution** : Le plan est structuré en **3 vagues successives**. La Vague 1 doit être engagée immédiatement avant toute campagne de déploiement à grande échelle.
>
> 1. **Vague 1 (Immédiate - 3 semaines)** : Découplage Async des PDF/Bulletins + Session de Caisse & Rapprochement Espèces + Saisie des notes matricielle avec import/export Excel.
> 2. **Vague 2 (Court terme - 4 semaines)** : Mode Offline-First (PWA / IndexedDB) pour les guichets de caisse et l'appel en classe + Conformité ministérielle des bulletins.
> 3. **Vague 3 (Moyen terme)** : Flywheel parents (WhatsApp/SMS) et modèle de prélèvement annuel automatisé.

> [!WARNING]
> **Décision d'infrastructure** : Pour le traitement asynchrone des PDF de bulletins et des exports massifs :
> - Option A (Recommandée) : Worker Redis / BullMQ si une instance Redis est activée en production.
> - Option B : Worker queue in-process avec file d'attente concurrente bornée (`p-limit` / worker threads légers) sans dépendance externe obligatoire, avec fallback Redis dès disponibilité.

---

## Open Questions

> [!IMPORTANT]
> 1. **Infrastructure Redis en Production** : Avez-vous déjà un cluster Redis actif sur Render/Upstash ou préférez-vous débuter avec un moteur de file asynchrone natif résilient avec persistance en base PostgreSQL ?
> 2. **Imprimantes de Guichet** : Les caisses des écoles utilisent-elles des imprimantes A4 standard ou des imprimantes thermiques de tickets (80mm / ESC-POS) pour les reçus d'encaissement ? *(Nous pouvons supporter les deux formats pour le reçu).*

---

## Plan d'Action Détaillé par Composant

---

### 1. Pare-feu Technique : Traitement Asynchrone & Anti-OOM des Bulletins

#### [NEW] [bulletinQueue.service.js](file:///d:/GestSchool/server/src/services/bulletinQueue.service.js)
* **Rôle** : File d'attente de génération asynchrone des bulletins et rapports.
* **Fonctionnalités** :
  * Concurrency Throttling (ex: max 2 générations simultanées par cœur CPU pour protéger l'API).
  * Streaming direct vers Cloudinary/S3 avec notification de progression en temps réel via Socket.IO (`req.io.to(tenantId)`).
  * Génération d'un fichier archive ZIP téléchargeable en un clic pour toute la classe.
  * Invalidation intelligente et mise en cache du hash du bulletin : ne régénère le PDF que si les notes ou appréciations ont changé.

#### [MODIFY] [bulletins.controller.js](file:///d:/GestSchool/server/src/controllers/bulletins.controller.js)
* Remplacement de l'exécution bloquante de `genererMasse` et `downloadPdf` par un dispatch de tâche asynchrone retournant un `jobId` + statut `pending | processing | completed | failed`.
* Ajout de l'endpoint `GET /api/bulletins/jobs/:jobId` pour le suivi de progression.

---

### 2. La Forteresse de Caisse : Sessions, Billetterie & Anti-Fraude

#### [MODIFY] [schema.prisma](file:///d:/GestSchool/server/prisma/schema.prisma)
Ajout des modèles dédiés à la tenue de caisse rigoureuse :
* `CaisseSession` :
  * `id`, `tenantId`, `caissierId`, `dateOuverture`, `dateCloture`, `statut` (`ouverte | fermee | validee_direction`).
  * `fondDeCaisse` (espèces initiales en début de journée).
  * `montantTheorique` (calculé automatiquement par la somme des encaissements/décaissements).
  * `montantReel` (montant compté physiquement lors de la clôture).
  * `ecart` (différence entre théorique et réel, avec justification obligatoire).
  * `billetterie` (détail JSON du comptage : billets de 10 000, 5 000, 2 000, 1 000, 500 et pièces).
* `PaiementAnnulation` :
  * Historique d'annulation ou rectification avec motif obligatoire, identifiant du superviseur ayant autorisé l'opération et génération automatique d'un contre-reçu (avoir).

#### [NEW] [caisse.controller.js](file:///d:/GestSchool/server/src/controllers/caisse.controller.js)
* `POST /api/caisse/sessions/ouvrir` : Ouverture de la caisse journalière avec fond de caisse.
* `POST /api/caisse/sessions/cloturer` : Clôture avec billetterie physique et calcul d'écart.
* `GET /api/caisse/sessions/active` : Consultation de la session courante du caissier.
* `POST /api/paiements/:id/annuler` : Procédure stricte d'annulation d'un paiement avec enregistrement d'audit infalsifiable.

---

### 3. Ergonomie Terrain : Saisie Matricielle & Excel Zéro-Friction

#### [NEW] [evaluations.excel.service.js](file:///d:/GestSchool/server/src/services/evaluations.excel.service.js)
* **Export Excel Matriciel** : Génération d'une feuille Excel protégée pré-remplie avec la liste des élèves (matricule, nom, prénom) et les colonnes d'évaluations/devoirs.
* **Import Excel Intelligent** :
  * Parsing sans erreur du fichier réimporté même si l'enseignant a modifié l'ordre.
  * Validation des notes (bornes 0-20 ou notation paramétrée, détection des fautes de frappe).
  * Rapport de réconciliation clair ("45 notes importées, 0 erreur").

#### [MODIFY] [client/src/pages/enseignant](file:///d:/GestSchool/client/src/pages/enseignant)
* **Grille de Saisie Rapide (Spreadsheet UI)** :
  * Navigation au clavier (Flèche Bas = élève suivant, Touche Entrée = validation).
  * Indicateur visuel d'auto-sauvegarde en direct ("Enregistré localement" -> "Synchronisé serveur").
  * Mode ultra-léger pour mobile Android sans aucun composant superflu.

---

### 4. Résilience Hors-Ligne (Offline-First pour Guichet & Appel)

#### [NEW] [client/src/services/offlineQueue.js](file:///d:/GestSchool/client/src/services/offlineQueue.js)
* Gestionnaire IndexedDB transparent pour les opérations critiques de terrain :
  * Encaissements au guichet en cas de coupure internet.
  * Appel des absences en salle de classe.
* Génération immédiate de reçu local avec numéro de reçu temporaire hors-ligne.
* Synchronisation en arrière-plan (Background Sync) dès que l'événement `window.addEventListener('online')` est déclenché.

---

### 5. La Flywheel de Croissance Exponentielle (GTM & Rétention)

```mermaid
graph LR
    A[Inscription de Septembre] -->|Acompte Licence 100% Réglé| B[Trésorerie GestSchool Sécurisée]
    B --> C[Cartes Scolaires QR Code aux Élèves]
    C --> D[Parents scannent & installent le Portail]
    D --> E[Bouche-à-oreille entre Familles & Écoles]
    E -->|Nouvelles Écoles à la Rentrée N+1| A
```

1. **Paiement Annuel Garanti à la Rentrée** :
   * La facture logicielle annuelle est intégrée et payée directement sur les frais d'inscription de septembre (0 risque d'impayé en milieu d'année scolaire).
2. **Effet Réseau via la Carte Scolaire Sécurisée** :
   * Génération automatique des badges et cartes scolaires avec photo, matricule et QR Code de vérification d'authenticité.
   * La carte scolaire physique devient la vitrine tangible et prestigieuse de l'école et de GestSchool auprès de tous les parents.
3. **Virilité Parentale** :
   * Le parent qui suit les notes et les absences de son aîné sur GestSchool exige des directeurs des écoles de ses autres enfants qu'ils s'équipent également de GestSchool.

---

## Verification Plan

### 1. Tests Automatisés
* **Tests Unitaires / Intégration (Vitest)** :
  * Validation du workflow de caisse : ouverture, encaissement, clôture avec billetterie, calcul de l'écart.
  * Validation de l'import/export Excel : vérification du parsing et de la conformité des notes.
  * Validation du concurrency throttler pour les bulletins.
* **Commande** :
  ```bash
  cd server && npx vitest run
  ```

### 2. Tests de Charge & Résilience (k6)
* Simulation de 200 générations simultanées de bulletins de classe pour vérifier l'absence d'OOM et le maintien d'une latence API < 200ms pour les autres requêtes.

### 3. Validation Manuelle & Scénario Terrain
* Coupure délibérée de la connexion réseau dans le navigateur (DevTools Offline).
* Réalisation de 3 encaissements au guichet : impression du reçu local.
* Rétablissement du réseau : vérification de la synchronisation automatique en base de données sans duplication.
