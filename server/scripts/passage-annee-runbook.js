/**
 * Runbook passage d'année (dry-run avant rentrée)
 * ================================================
 *
 * Prérequis
 * - Backup Postgres restaurable testé
 * - Année N active ; année N+1 en brouillon (dupliquer) avec classes
 * - Décisions fin d'année saisies (ou suggestions passage)
 *
 * Séquence recommandée (API / UI directeur)
 * 1. POST /api/annees-scolaires/:idN/dupliquer  → crée N+1 brouillon
 * 2. Vérifier classes / affectations sur N+1
 * 3. GET  /api/inscriptions/eligibles-reinscription?anneeSourceId=&anneeCibleId=
 * 4. POST /api/inscriptions/reinscription-lot  (décisions + classes cibles)
 * 5. POST /api/annees-scolaires/:idN1/activate → une seule active ; brouillons conservés
 * 6. Contrôler TenantConfig.anneeScolaireActiveId + effectifs N+1
 *
 * Script manuel (demo locale) : node scripts/test-passage-annee.js
 * Tests auto : src/utils/anneeActive.test.js
 *
 * Rollback
 * - Ré-activer l'année N (activate) ; les inscriptions N+1 restent mais hors année active
 * - Restaurer le backup si corruption financière
 */
export const PASSAGE_ANNEE_RUNBOOK = true;
