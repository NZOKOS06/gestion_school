-- AlterTable
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "saisieNotesOuverte" BOOLEAN NOT NULL DEFAULT true;
