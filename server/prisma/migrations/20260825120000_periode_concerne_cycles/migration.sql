-- AlterTable PeriodeScolaire: cycles concernés (préscolaire/primaire vs collège/lycée)
ALTER TABLE "PeriodeScolaire" ADD COLUMN IF NOT EXISTS "concerneCycles" JSONB;
