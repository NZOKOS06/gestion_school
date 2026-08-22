-- Dédupliquer les années actives legacy (garder la plus récente par tenant)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "dateDebut" DESC, "createdAt" DESC) AS rn
  FROM "AnneeScolaire"
  WHERE actif = true
)
UPDATE "AnneeScolaire" AS a
SET
  actif = false,
  statut = CASE
    WHEN a.statut = 'active' THEN 'archivee'::"StatutAnneeScolaire"
    ELSE a.statut
  END
FROM ranked AS r
WHERE a.id = r.id AND r.rn > 1;

-- Une seule année scolaire avec actif=true par tenant (garde-fou DB).
-- Les brouillons restent autorisés en parallèle (actif=false).
CREATE UNIQUE INDEX IF NOT EXISTS "AnneeScolaire_tenantId_actif_true_key"
ON "AnneeScolaire" ("tenantId")
WHERE "actif" = true;
