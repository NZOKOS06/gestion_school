-- Migration: Ajout des champs fraisInscription, fraisMensuel et nombreMois sur la table Classe
-- montantAnnuel = fraisMensuel * nombreMois + fraisInscription
-- fraisScolarite reste le total calculé (rétrocompatibilité)

ALTER TABLE "Classe" ADD COLUMN IF NOT EXISTS "fraisInscription" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Classe" ADD COLUMN IF NOT EXISTS "fraisMensuel"     DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Classe" ADD COLUMN IF NOT EXISTS "nombreMois"       INTEGER        NOT NULL DEFAULT 9;
