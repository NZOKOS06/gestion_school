-- Frais de réinscription (classe + défaut école) et tarif appliqué / spécial sur l'inscription
ALTER TABLE "TenantConfig" ADD COLUMN "fraisReinscriptionDefault" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

ALTER TABLE "Classe" ADD COLUMN "fraisReinscription" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "Inscription" ADD COLUMN "typeFrais" TEXT NOT NULL DEFAULT 'inscription';
ALTER TABLE "Inscription" ADD COLUMN "fraisInscriptionApplique" DECIMAL(12,2);
ALTER TABLE "Inscription" ADD COLUMN "fraisScolariteApplique" DECIMAL(12,2);
ALTER TABLE "Inscription" ADD COLUMN "tarifSpecial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inscription" ADD COLUMN "motifTarifSpecial" TEXT;
