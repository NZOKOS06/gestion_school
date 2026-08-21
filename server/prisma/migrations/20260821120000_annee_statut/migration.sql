-- CreateEnum
CREATE TYPE "StatutAnneeScolaire" AS ENUM ('brouillon', 'active', 'archivee');

-- AlterTable
ALTER TABLE "AnneeScolaire" ADD COLUMN "statut" "StatutAnneeScolaire" NOT NULL DEFAULT 'brouillon';

-- Backfill from actif
UPDATE "AnneeScolaire" SET "statut" = 'active' WHERE "actif" = true;
UPDATE "AnneeScolaire" SET "statut" = 'archivee' WHERE "actif" = false;

-- Index
CREATE INDEX "AnneeScolaire_statut_idx" ON "AnneeScolaire"("statut");
