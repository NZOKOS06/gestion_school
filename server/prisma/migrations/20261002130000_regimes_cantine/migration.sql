-- Options régimes (plein temps / mi-temps) et cantine
ALTER TABLE "TenantConfig" ADD COLUMN "regimesActifs" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantConfig" ADD COLUMN "cantineActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantConfig" ADD COLUMN "cantinePeriodicite" TEXT NOT NULL DEFAULT 'mensuelle';
ALTER TABLE "TenantConfig" ADD COLUMN "tarifCantine" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

ALTER TABLE "Classe" ADD COLUMN "fraisMensuelMiTemps" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Classe" ADD COLUMN "fraisScolariteMiTemps" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "Inscription" ADD COLUMN "regime" TEXT NOT NULL DEFAULT 'plein_temps';
ALTER TABLE "Inscription" ADD COLUMN "cantine" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inscription" ADD COLUMN "tarifCantineApplique" DECIMAL(12,2);

-- Catégorie d'échéance (au lieu de déduire du libellé)
ALTER TABLE "Echeance" ADD COLUMN "categorie" TEXT NOT NULL DEFAULT 'scolarite';
UPDATE "Echeance" SET "categorie" = 'inscription' WHERE "libelle" ILIKE '%inscription%';
CREATE INDEX "Echeance_categorie_idx" ON "Echeance"("categorie");
