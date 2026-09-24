# 📘 GestSchool — Récapitulatif d'Évolution, Audit et Architecture du SI

Ce document sert de **référence unique et permanente** pour l'évolution du système d'information GestSchool, traçant l'ensemble des modules, des correctifs apportés, des règles métier fondamentales et des audits d'écrans pour tous les rôles.

---

## 1. Vue d'Ensemble & Architecture Multi-Tenant

GestSchool est un SaaS scolaire multi-tenant sécurisé :
- **Serveur (API)** : Node.js / Express / Prisma ORM / PostgreSQL distant (Render / Neon)
- **Client (Frontend)** : React (Vite) / Tailwind / Vanilla CSS / PWA Offline-first
- **Isolation des tenants** :
  - Résolution via `X-Tenant-Slug`, sous-domaine, ou route `/e/:slug/login`
  - Stockage dans `AsyncLocalStorage` (`asyncLocalStorage.run({ tenantId }, ...)`)
  - Extension Prisma `$extends` isolant automatiquement les requêtes par `tenantId`
  - Authentification sécurisée par Cookie HttpOnly (`accessToken`, `refreshToken`)

---

## 2. Historique des Corrections Récentes & Mises à Jour

| Date | Composant | Problème Résolu | Solution Appliquée |
|---|---|---|---|
| 17/09/2026 | **Auth Multi-Tenant** | Erreur 401 à la connexion sur `/e/:slug/login` | Le slug résolu depuis l'URL `/e/:slug` n'était pas injecté dans le header `X-Tenant-Slug` lors du POST `/api/auth/login`. Corrigé dans `Login.jsx`. |
| 17/09/2026 | **SuperAdmin Staff** | Impossibilité de réinitialiser le mot de passe d'un staff d'école depuis le superadmin | Ajout de la route `PUT /api/superadmin/tenants/:id/staff/:staffId/password` et du modal de réinitialisation dans `SuperAdminPanel.jsx`. |
| 17/09/2026 | **Contrôle des Modules** | Barrières bloquant le superadmin pour activer/désactiver des modules selon le plan | Suppression des verrous `locked` et `isModuleAvailableForPlan` dans `SharedUI.jsx` / `SuperAdminPanel.jsx`, et suppression de `enforceModuleConstraints` dans `superadmin.controller.js` pour donner le plein contrôle au superadmin indépendamment du plan souscrit. |
| 17/09/2026 | **Cohérence Navigation UI** | Des modules désactivés par l'école restaient visibles dans la sidebar (ex: Salles) | Association systématique de chaque item de menu à son module (`module: 'emploiDuTemps'`, `module: 'salles'`, etc.) et filtrage strict dans `AppShell.jsx`. |
| 17/09/2026 | **Stabilité Dashboards** | Erreurs 500 sur Dashboard, Paiements et Rapports | Audit et sécurisation des requêtes Prisma avec gestion résiliente de l'absence d'année scolaire active ou de données vides. |
| 18/09/2026 | **Structure Financière des Classes** | Les frais étaient saisis sous forme d'un montant annuel brut unique sans distinction de l'inscription et des mensualités | Ajout de `fraisInscription`, `fraisMensuel` et `nombreMois` sur `Classe` (migration `20260918100000_classe_frais_detail`), calcul automatique transparent de la scolarité annuelle et intégration au wizard et aperçus d'inscription. |
| 18/09/2026 | **Page Inscriptions** | `ReferenceError: selectedClasse is not defined` au chargement de la page | Rétablissement de la variable `selectedClasse` dérivée de `classesForAnnee` pour le calcul de l'aperçu financier. |
| 18/09/2026 | **Bulletins & Périodes** | Erreur 400 sur `/api/bulletins/publier` (périodes manquantes) | Auto-bootstrap des périodes officielles adaptées aux cycles de l'établissement dans `listPeriodes` et à la création d'année scolaire. Sécurisation des boutons de publication et génération PDF dans `Bulletins.jsx`. |

---

## 3. Matrice des Modules du SI par Rôle

| Module | Clé Config | Directeur | Direct. Études | Secrétaire | Enseignant | Surveillant | Caissier/Comptable | Parent |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Dashboard** | — (core) | ✅ | ✅ | ✅ | ✅ (pédago) | ✅ | ✅ (caisse) | ✅ (famille) |
| **Élèves** | `moduleEleves` | ✅ | ✅ | ✅ | — | ✅ | ✅ (lecture) | — |
| **Classes** | `moduleClasses` | ✅ | ✅ | ✅ | ✅ (ses classes) | — | — | — |
| **Inscriptions** | `moduleInscriptions` | ✅ | ✅ | ✅ | — | — | — | — |
| **Matières** | — (core) | ✅ | ✅ | ✅ | — | — | — | — |
| **Enseignants** | `modulePersonnel` | ✅ | ✅ | ✅ | — | — | — | — |
| **Emploi du temps** | `moduleEmploiDuTemps` | ✅ | ✅ | ✅ | ✅ (mon emploi) | ✅ | — | — |
| **Salles** | `moduleEmploiDuTemps` | ✅ | ✅ | ✅ | — | — | — | — |
| **Absences / Appel** | `modulePresences` | ✅ | ✅ | ✅ | ✅ (appel) | ✅ | — | ✅ (enfants) |
| **Pointage Personnel**| `modulePointagePersonnel` | ✅ | ✅ | — | ✅ (mes pointages) | ✅ | — | — |
| **Sanctions** | `moduleSanctions` | ✅ | ✅ | ✅ | — | ✅ | — | ✅ (enfants) |
| **Notes & Évaluations**| `moduleNotes` | ✅ | ✅ | — | ✅ (saisie) | — | — | ✅ (enfants) |
| **Bulletins** | `moduleBulletins` | ✅ | ✅ | — | — | — | — | ✅ (enfants) |
| **Paiements / Caisse** | `modulePaiements` | ✅ | — | — | — | — | ✅ (encaissements) | ✅ (factures) |
| **Paie du personnel** | `modulePaie` | ✅ | — | — | — | — | ✅ | — |
| **Rapports Financiers**| `moduleRapports` | ✅ | — | — | — | — | — | — |
| **Messagerie** | — (core) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Calendrier** | — (core) | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |

---

## 4. Parcours d'Audit & Validation des Écrans (SI Complet)

1. **Écrans Directeur** :
   - `/admin/dashboard` (KPIs, alertes, graphiques, présence, caisse du jour)
   - `/admin/eleves`, `/admin/classes`, `/admin/inscriptions`, `/admin/matieres`, `/admin/enseignants`
   - `/admin/emploi-du-temps`, `/admin/salles`, `/admin/absences`, `/admin/sanctions`
   - `/admin/cahier-de-textes`, `/admin/conseil-de-classe`, `/admin/bulletins`, `/admin/examens`
   - `/admin/paiements`, `/admin/paie`, `/admin/rapports`, `/admin/personnel`, `/admin/configuration`
2. **Écrans Enseignant** :
   - `/enseignant/dashboard`, `/enseignant/classes`, `/enseignant/notes`, `/enseignant/appel`, `/enseignant/emploi`, `/enseignant/pointages`
3. **Écrans Parent** :
   - `/parent/dashboard`, `/parent/enfants`, `/parent/bulletins`, `/parent/absences`, `/parent/sanctions`, `/parent/facturation`
4. **Écrans Caissier / Comptable** :
   - `/caissier` (Dashboard caisse), `/caissier/eleves` (Dossier financier), `/caissier/encaisser` (Encaissement), `/caissier/retards` (Échéances en retard)
5. **Écrans SuperAdmin** :
   - `/super-admin/dashboard`, `/super-admin/tenants` (gestion écoles, modules sans restriction, réinitialisation de passe, bascule de plans)

---

## 5. Règles Anti-Régression Strictes
1. **Toujours tester avec et sans année scolaire active** : Les contrôleurs ne doivent jamais crasher (500) si une école vient d'être créée et n'a pas encore configuré d'année scolaire.
2. **Gestion défensive des jointures** : Les relations optionnelles (`inscription.eleve`, `inscription.classe`, `anneeScolaire`) doivent être vérifiées avec optional chaining (`?.`) et fallbacks appropriés.
3. **Sécurité & Filtrage Multi-Tenant** : Toute requête doit être étanche au tenant et ne jamais exposer de données d'autres écoles.
