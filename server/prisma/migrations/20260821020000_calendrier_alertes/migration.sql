-- AlterEnum TypeEvenementCalendrier
ALTER TYPE "TypeEvenementCalendrier" ADD VALUE 'reprise_cours';

-- AlterEnum TypeNotification
ALTER TYPE "TypeNotification" ADD VALUE 'evenement';

-- AlterTable
ALTER TABLE "CalendrierScolaire" ADD COLUMN "alerteEnvoyeeAt" TIMESTAMP(3);
