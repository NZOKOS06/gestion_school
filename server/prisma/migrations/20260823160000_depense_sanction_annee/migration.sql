-- Rattacher dépenses et sanctions à une année scolaire (archivage par année)

ALTER TABLE "Depense" ADD COLUMN IF NOT EXISTS "anneeScolaireId" TEXT;
ALTER TABLE "Sanction" ADD COLUMN IF NOT EXISTS "anneeScolaireId" TEXT;

-- Backfill Depense : année dont la date tombe dans [dateDebut, dateFin]
UPDATE "Depense" d
SET "anneeScolaireId" = a.id
FROM "AnneeScolaire" a
WHERE d."anneeScolaireId" IS NULL
  AND a."tenantId" = d."tenantId"
  AND d."dateDepense" >= a."dateDebut"
  AND d."dateDepense" <= a."dateFin";

-- Fallback Depense : année active du tenant
UPDATE "Depense" d
SET "anneeScolaireId" = a.id
FROM "AnneeScolaire" a
WHERE d."anneeScolaireId" IS NULL
  AND a."tenantId" = d."tenantId"
  AND (a."statut" = 'active' OR a."actif" = true);

-- Backfill Sanction
UPDATE "Sanction" s
SET "anneeScolaireId" = a.id
FROM "AnneeScolaire" a
WHERE s."anneeScolaireId" IS NULL
  AND a."tenantId" = s."tenantId"
  AND s."dateSanction" >= a."dateDebut"
  AND s."dateSanction" <= a."dateFin";

UPDATE "Sanction" s
SET "anneeScolaireId" = a.id
FROM "AnneeScolaire" a
WHERE s."anneeScolaireId" IS NULL
  AND a."tenantId" = s."tenantId"
  AND (a."statut" = 'active' OR a."actif" = true);

CREATE INDEX IF NOT EXISTS "Depense_anneeScolaireId_idx" ON "Depense"("anneeScolaireId");
CREATE INDEX IF NOT EXISTS "Sanction_anneeScolaireId_idx" ON "Sanction"("anneeScolaireId");

DO $$ BEGIN
  ALTER TABLE "Depense"
    ADD CONSTRAINT "Depense_anneeScolaireId_fkey"
    FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Sanction"
    ADD CONSTRAINT "Sanction_anneeScolaireId_fkey"
    FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
