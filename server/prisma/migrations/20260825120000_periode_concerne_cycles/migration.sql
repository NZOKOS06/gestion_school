-- AlterTable PeriodeScolaire: cycles concernes (prescolaire/primaire vs college/lycee)
ALTER TABLE "PeriodeScolaire" ADD COLUMN IF NOT EXISTS "concerneCycles" JSONB;
