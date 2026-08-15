# Création du Portail Gestionnaire (Comptable)

Ce plan vise à améliorer l'interface du Gestionnaire en lui offrant un véritable tableau de bord et une vue spécialisée pour la gestion financière des élèves, comme demandé.

## 1. Tableau de bord Gestionnaire (`CaissierDashboard.jsx`)
Création d'un tableau de bord inspiré de celui du surveillant/admin, mais orienté finances :
- Indicateurs clés (KPI) : Recettes du mois, Taux d'impayés, Objectif mensuel.
- Graphique d'évolution des paiements sur les 30 derniers jours.
- Liste des 5 derniers paiements encaissés.
- Liste des échéances en retard critiques.

## 2. Module Élèves - Vue Finances (`ElevesFinances.jsx`)
C'est le coeur de votre demande. Un module listant les élèves, mais optimisé pour le gestionnaire.
- **Liste des élèves** avec des indicateurs sur leur statut financier (À jour, En retard).
- **Fiche Détail (Modal)** :
  - Informations de l'élève en haut (Nom, classe, solde, parent).
  - En dessous, un **Échéancier interactif** (liste des mois/tranches).
  - **Comportement dynamique** : Chaque mois affiche : `Mois | Frais | Reste à payer | Avance`.
  - Un champ de saisie permet d'entrer un montant global ou spécifique. Si le montant entré est **supérieur** au reste à payer du mois, le mois est marqué comme "surpayé" et le reliquat (l'avance) remplit automatiquement le champ du mois suivant.
  - Un bouton "Valider les paiements" qui enregistre la répartition.

> [!TIP]
> **Logique de cascade (Avance)** : Tout sera calculé en temps réel dans l'interface (React) pour que vous voyiez l'avance glisser sur les mois suivants avant même de valider.

## 3. Nouveau module proposé : Dépenses (`Depenses.jsx`)
Un Gestionnaire ne fait pas qu'encaisser, il gère aussi les sorties d'argent. 
- Ajout d'un modèle `Depense` dans la base de données (Catégorie, Montant, Date, Motif).
- Création d'une page pour enregistrer et suivre les dépenses de l'établissement (salaires, factures, achat de matériel).
- Intégration des dépenses dans les rapports financiers pour avoir le bénéfice réel.

## 4. Ajustements Backend
- Création d'un point d'accès API `/api/paiements/batch` pour enregistrer en une seule fois les paiements répartis sur plusieurs mois (échéances) suite à l'utilisation de l'avance.
- (Si approuvé) Création du modèle et des routes `/api/depenses`.

## 5. Navigation (`CaissierLayout.jsx` et `App.jsx`)
Mise à jour du menu latéral du Gestionnaire :
- 📊 Tableau de bord
- 🎓 Élèves (Finances)
- 💰 Caisse (Historique paiements)
- 📉 Dépenses (Nouveau)
- 📈 Rapports

## User Review Required
> [!IMPORTANT]
> - Validez-vous la création du module "Dépenses" en plus des paiements ?
> - Pour la logique d'avance : si un parent donne 100 000 FCFA et que le mois coûte 30 000 FCFA, l'interface paiera le mois 1 (30k), le mois 2 (30k), le mois 3 (30k), et il restera 10k d'avance sur le mois 4. Êtes-vous d'accord avec cette répartition automatique ?
