# BRIEFING GESTPHARMA - Fonctionnement par Acteur et Module

## 📋 Vue d'ensemble

GestPharma est une SaaS multi-tenant de gestion de pharmacie avec **8 acteurs principaux** et **13 modules** configurables.

---

## 👥 ACTEURS ET LEURS RÔLES

### 1. SUPER ADMIN
**Rôle:** Administrateur système global
**Accès:** Panel super-admin dédié
**Responsabilités:**
- Gestion des tenants (pharmacies)
- Configuration globale de l'application
- Gestion des abonnements et plans

**Pages accessibles:**
- `/super-admin` - Panel de gestion des tenants

---

### 2. PHARMACIEN / ADMIN
**Rôle:** Gestionnaire principal de la pharmacie
**Accès:** Layout Admin (menu complet)
**Responsabilités:**
- Supervision de tous les modules
- Gestion du catalogue et stock
- Validation des ordonnances
- Rapports et analytics
- Gestion du personnel

**Pages accessibles:**
- `/admin/dashboard` - **Tableau de bord**
  - KPIs: Ventes du jour/semaine/mois
  - Alertes: Stock critique, péremptions, ordonnances en attente
  - Top produits du mois
  - Vue d'ensemble de l'activité

- `/admin/catalogue` - **Gestion du Catalogue**
  - CRUD médicaments (DCI, nom commercial, forme galénique, dosage)
  - Gestion des prix (achat/vente/marge)
  - Seuils d'alerte stock
  - Indicateur ordonnance requise
  - Lien avec fournisseurs et catégories

- `/admin/stock` - **Gestion des Stocks**
  - Vue globale des stocks par médicament
  - Filtres par catégorie, recherche
  - Alertes de rupture de stock
  - Ajustements de stock (entrées/sorties)
  - Historique des mouvements
  - Vue des lots et péremptions

- `/admin/lots` - **Gestion des Lots & Péremptions**
  - Traçabilité par numéro de lot
  - Gestion des dates de péremption
  - Alertes péremptions proches (configurable: 90 jours par défaut)
  - Réception des lots fournisseurs
  - Emplacement dans le dépôt

- `/admin/fournisseurs` - **Gestion des Fournisseurs**
  - CRUD fournisseurs (nom, contact, email, téléphone, adresse)
  - Délai de livraison moyen
  - Historique des commandes par fournisseur
  - Médicaments associés

- `/admin/commandes-fournisseurs` - **Commandes Fournisseurs**
  - Création de commandes (brouillon → envoyée → reçue)
  - Lignes de commande avec quantités demandées/reçues
  - Suivi des livraisons estimées
  - Réception et validation des quantités
  - Historique des commandes

- `/admin/ordonnances` - **Gestion des Ordonnances**
  - Liste des ordonnances uploadées par le staff
  - Validation/refus par le pharmacien
  - Association avec vente
  - Infos médecin et patient
  - Statuts: en_attente → validee → dispensee → refusee

- `/admin/ventes` - **Gestion des Ventes**
  - Historique complet des ventes
  - Filtres par statut, période, vendeur
  - Détail des lignes de vente
  - Annulation de ventes
  - Export des données

- `/admin/livraisons` - **Gestion des Livraisons**
  - Assignation des livreurs
  - Suivi des statuts: assignée → en_route → livrée → échec
  - Adresse et instructions de livraison
  - Historique des livraisons

- `/admin/personnel` - **Gestion du Personnel**
  - CRUD staff (nom, prénom, email, rôle, téléphone)
  - Gestion des mots de passe
  - Activation/désactivation de comptes
  - Historique des connexions

- `/admin/rapports` - **Rapports & Analytics**
  - Rapports de ventes (périodes personnalisables)
  - Rapports de stock
  - Rapports fournisseurs
  - Export PDF/Excel
  - Graphiques et tendances

- `/admin/configuration` - **Configuration** (Super Admin uniquement)
  - Personnalisation (logo, couleurs, nom app)
  - Configuration des modules (13 modules activables/désactivables)
  - Paramètres: TVA, frais livraison, seuils alertes
  - Horaires d'ouverture
  - Devise

---

### 3. VENDEUR / PRÉPARATEUR
**Rôle:** Vente au comptoir et préparation des commandes
**Accès:** Layout Staff (menu restreint)
**Responsabilités:**
- Création de ventes comptoir
- Scan et upload d'ordonnances
- Consultation de ses ventes

**Pages accessibles:**
- `/staff/dashboard` - **Tableau de bord Vendeur**
  - KPIs personnels: Ventes du jour, CA personnel
  - Alertes stock (si autorisé)
  - Dernières ventes réalisées
  - Actions rapides: Nouvelle vente, Scanner ordonnance

- `/staff/vente` - **Nouvelle Vente**
  - Recherche médicaments (par DCI, nom commercial, code-barres)
  - Ajout au panier avec gestion des quantités
  - Vérification du stock en temps réel
  - Infos client (nom, téléphone - optionnels)
  - Type de vente: comptoir ou livraison
  - Validation de la vente → redirection vers caisse ou mes ventes

- `/staff/mes-ventes` - **Mes Ventes**
  - Historique des ventes du vendeur connecté
  - Statuts: en_cours, finalisee, annulee
  - Détail des lignes de vente
  - Montants totaux

- `/staff/ordonnance` - **Scan Ordonnance**
  - Upload photo/PDF d'ordonnance
  - Drag & drop supporté
  - Infos médecin (nom, numéro d'ordre)
  - Date de l'ordonnance
  - Infos client (nom, téléphone)
  - Note optionnelle
  - Notification temps réel quand validée par pharmacien

---

### 4. CAISSIER
**Rôle:** Encaissement des ventes
**Accès:** Layout Caissier (menu dédié)
**Responsabilités:**
- Réception des ventes en attente
- Encaissement et validation des paiements
- Gestion des modes de paiement

**Pages accessibles:**
- `/caissier` - **Accueil Caisse**
  - KPIs: Ventes en attente, CA du jour, Total à encaisser
  - Liste des ventes en attente d'encaissement
  - Actualisation automatique (toutes les 30s)
  - Modal de détail de vente
  - Action: Encaisser

- `/caissier/encaisser/:id` - **Encaissement Vente**
  - Détail complet de la vente
  - Liste des articles avec quantités et prix
  - Sélection du mode de paiement: espèces, mobile money, carte, crédit
  - Saisie du montant reçu
  - Calcul automatique de la monnaie
  - Validation du paiement → vente finalisée
  - Gestion des transactions mobile money (référence)

---

### 5. LIVREUR
**Rôle:** Livraison des commandes à domicile
**Accès:** Route dédiée (sans layout complet)
**Responsabilités:**
- Réception des assignations de livraison
- Mise à jour du statut de livraison
- Gestion des échecs de livraison

**Pages accessibles:**
- `/staff/livraisons` - **Mes Livraisons**
  - Liste des livraisons assignées
  - Statuts: assignée, en_route, livrée, échec
  - Adresse et instructions de livraison
  - Téléphone client
  - Actions: Marquer en route, Marquer livrée, Signaler échec
  - Motif d'échec si applicable

---

### 6. CLIENT
**Rôle:** Patient final utilisant la pharmacie
**Accès:** Layout Public (espace client)
**Responsabilités:**
- Consultation du catalogue public
- Commande en ligne (si module activé)
- Suivi de ses commandes
- Gestion de ses ordonnances

**Pages accessibles:**
- `/profil` - **Dashboard Client**
  - Profil utilisateur (nom, prénom, email, téléphone)
  - Statistiques: Total achats, nombre de commandes, nombre d'ordonnances
  - Activité récente (dernières commandes)
  - Liens rapides vers historique et ordonnances

- `/profil/historique` - **Historique des Commandes**
  - Liste complète des achats
  - Détail de chaque commande
  - Montants et dates
  - Statuts

- `/profil/ordonnances` - **Mes Ordonnances**
  - Liste des ordonnances uploadées
  - Statuts: en_attente, validee, dispensee, refusee
  - Détail et images des ordonnances
  - Infos médecins

**Pages publiques (sans connexion):**
- `/` - **Accueil** - Page d'accueil publique avec présentation de la pharmacie
- `/catalogue` - **Catalogue Public** - Consultation des médicaments disponibles
- `/commander` - **Commande en Ligne** - Panier et commande (si module activé)
- `/suivi/:id` - **Suivi de Commande** - Suivi en temps réel d'une livraison
- `/login` - **Connexion** - Authentification staff et clients
- `/register` - **Inscription** - Création compte client
- `/changer-mot-de-passe` - **Changement mot de passe** - Pour premier connexion ou reset

---

## 📦 MODULES CONFIGURABLES (13)

Le super-admin peut activer/désactiver ces modules dans la configuration:

1. **moduleCatalogue** - Gestion du catalogue médicaments
2. **moduleStock** - Gestion des stocks et lots
3. **moduleVentes** - Module de vente et caisse
4. **moduleOrdonnances** - Gestion des ordonnances numériques
5. **moduleFournisseurs** - Gestion des fournisseurs et commandes
6. **modulePersonnel** - Gestion du staff
7. **moduleRapports** - Rapports et analytics
8. **moduleLivraison** - Livraison à domicile
9. **moduleCommandeEnLigne** - Commandes en ligne par clients
10. **modulePatients** - Dossiers patients complets
11. **moduleInteractions** - Vérification interactions médicamenteuses
12. **moduleFidelite** - Programme de fidélité clients
13. **moduleMultiDepot** - Gestion multi-dépôts

---

## 🔄 FLUX DE TRAVAIL PRINCIPAUX

### Flux Vente Comptoir
1. **Vendeur** crée une nouvelle vente (`/staff/vente`)
2. Recherche et ajoute les médicaments au panier
3. Saisit les infos client (optionnel)
4. Valide la vente → statut "en_cours"
5. **Caissier** reçoit la vente dans sa file (`/caissier`)
6. Sélectionne le mode de paiement
7. Encaisse → statut "finalisee"
8. Stock déduit automatiquement (FEFO: First Expired First Out)

### Flux Ordonnance
1. **Vendeur** scanne/upload l'ordonnance (`/staff/ordonnance`)
2. Saisit infos médecin et client
3. Soumet → statut "en_attente"
4. **Pharmacien/Admin** reçoit notification
5. Valide ou refuse l'ordonnance (`/admin/ordonnances`)
6. Si validée → statut "validee"
7. Vendeur notifié en temps réel (Socket.IO)
8. Vente créée à partir de l'ordonnance

### Flux Commande Fournisseur
1. **Admin** crée une commande fournisseur (`/admin/commandes-fournisseurs`)
2. Ajoute les médicaments et quantités
3. Statut "brouillon" → peut être modifié
4. Envoie la commande → statut "envoyée"
5. Réception de la livraison → statut "recue" ou "partielle"
6. Quantités reçues saisies
7. Lots créés automatiquement avec stocks mis à jour

### Flux Livraison
1. Client commande en ligne ou vente comptoir avec type "livraison"
2. **Admin** assigne un livreur (`/admin/livraisons`)
3. **Livreur** voit la livraison assignée (`/staff/livraisons`)
4. Marque "en_route" lors du départ
5. Marque "livrée" ou "échec" à l'arrivée
6. Client peut suivre en temps réel (`/suivi/:id`)

---

## 🔐 SÉCURITÉ ET PERMISSIONS

- **Multi-tenant:** Chaque pharmacie (tenant) a ses données isolées
- **RBAC:** Contrôle d'accès basé sur les rôles
- **Middleware:** Authentification JWT + vérification tenant par slug
- **Première connexion:** Obligation de changer le mot de passe

---

## 🎯 POINTS CLÉS À EXPLIQUER AU CLIENT

1. **Architecture multi-tenant:** Une seule instance pour plusieurs pharmacies
2. **Modularité:** 13 modules activables selon les besoins
3. **Traçabilité:** Gestion des lots et péremptions (FEFO)
4. **Temps réel:** Notifications Socket.IO pour ordonnances
5. **Rôles distincts:** Séparation claire des responsabilités
6. **Personnalisation:** Branding configurable par pharmacie
7. **Alertes automatiques:** Stock critique, péremptions proches
8. **Rapports:** Analytics complets pour prise de décision

---

## 📱 INTERFACE UTILISATEUR

- **Thème:** Mode sombre/clair
- **Responsive:** Desktop, tablette, mobile
- **Langue:** Support multilingue (i18n)
- **Design:** Moderne avec composants UI réutilisables
- **Performance:** Chargement optimisé avec lazy loading

---

*Document généré automatiquement à partir de l'analyse du code source GestPharma*
