/*
  Warnings:

  - A unique constraint covering the columns `[qrCodeHash]` on the table `Bulletin` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TypeAbsence" AS ENUM ('absent', 'retard', 'depart_anticipe');

-- CreateEnum
CREATE TYPE "DecisionFinAnnee" AS ENUM ('passage', 'redoublement', 'orientation', 'exclusion');

-- CreateEnum
CREATE TYPE "TypeContrat" AS ENUM ('titulaire', 'vacataire', 'stagiaire', 'contractuel');

-- CreateEnum
CREATE TYPE "TypeEvenementCalendrier" AS ENUM ('rentree', 'vacances', 'examen', 'jour_ferie', 'conseil_classe', 'evenement_scolaire', 'composition');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'conseil_classe_tenu';
ALTER TYPE "AuditAction" ADD VALUE 'cahier_de_textes_saisi';
ALTER TYPE "AuditAction" ADD VALUE 'message_envoye';
ALTER TYPE "AuditAction" ADD VALUE 'decision_fin_annee';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeCertificat" ADD VALUE 'attestation_inscription';
ALTER TYPE "TypeCertificat" ADD VALUE 'releve_notes';
ALTER TYPE "TypeCertificat" ADD VALUE 'carte_scolaire';
ALTER TYPE "TypeCertificat" ADD VALUE 'convocation_examen';

-- AlterEnum
ALTER TYPE "TypeEvaluation" ADD VALUE 'pratique';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeNotification" ADD VALUE 'message';
ALTER TYPE "TypeNotification" ADD VALUE 'relance_impaye';

-- AlterEnum
ALTER TYPE "TypePaiement" ADD VALUE 'transport';

-- AlterTable
ALTER TABLE "Absence" ADD COLUMN     "typeAbsence" "TypeAbsence" NOT NULL DEFAULT 'absent';

-- AlterTable
ALTER TABLE "Bulletin" ADD COLUMN     "qrCodeHash" TEXT;

-- AlterTable
ALTER TABLE "EmploiDuTemps" ADD COLUMN     "salleId" TEXT;

-- AlterTable
ALTER TABLE "Inscription" ADD COLUMN     "decisionFinAnnee" "DecisionFinAnnee";

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "heuresHebdo" INTEGER,
ADD COLUMN     "tauxHoraire" DECIMAL(10,2),
ADD COLUMN     "typeContrat" "TypeContrat" NOT NULL DEFAULT 'titulaire';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "pays" TEXT NOT NULL DEFAULT 'CG',
ADD COLUMN     "typeEtablissement" TEXT NOT NULL DEFAULT 'primaire';

-- AlterTable
ALTER TABLE "TenantConfig" ADD COLUMN     "conventionPeriode" TEXT NOT NULL DEFAULT 'trimestre';

-- CreateTable
CREATE TABLE "Salle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "batiment" TEXT,
    "capacite" INTEGER NOT NULL DEFAULT 40,
    "type" TEXT NOT NULL DEFAULT 'cours',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendrierScolaire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" "TypeEvenementCalendrier" NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "description" TEXT,
    "concerneCycles" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendrierScolaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CahierDeTextes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "emploiDuTempsId" TEXT,
    "dateCours" TIMESTAMP(3) NOT NULL,
    "lecon" TEXT NOT NULL,
    "devoirsDonnes" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CahierDeTextes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConseilDeClasse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "periodeIndex" INTEGER NOT NULL,
    "dateConseil" TIMESTAMP(3) NOT NULL,
    "presidentId" TEXT NOT NULL,
    "compteRendu" TEXT,
    "cloture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConseilDeClasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConseilParticipant" (
    "id" TEXT NOT NULL,
    "conseilId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "observations" TEXT,

    CONSTRAINT "ConseilParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeureEnseignee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "classeId" TEXT,
    "matiereId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "dureeHeures" DECIMAL(5,2) NOT NULL,
    "validee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeureEnseignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expediteurId" TEXT NOT NULL,
    "destinataireStaffId" TEXT,
    "destinataireUserId" TEXT,
    "sujet" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "dateLecture" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Salle_tenantId_idx" ON "Salle"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Salle_tenantId_nom_key" ON "Salle"("tenantId", "nom");

-- CreateIndex
CREATE INDEX "CalendrierScolaire_tenantId_idx" ON "CalendrierScolaire"("tenantId");

-- CreateIndex
CREATE INDEX "CalendrierScolaire_anneeScolaireId_idx" ON "CalendrierScolaire"("anneeScolaireId");

-- CreateIndex
CREATE INDEX "CalendrierScolaire_type_idx" ON "CalendrierScolaire"("type");

-- CreateIndex
CREATE INDEX "CalendrierScolaire_dateDebut_idx" ON "CalendrierScolaire"("dateDebut");

-- CreateIndex
CREATE INDEX "CahierDeTextes_tenantId_idx" ON "CahierDeTextes"("tenantId");

-- CreateIndex
CREATE INDEX "CahierDeTextes_enseignantId_idx" ON "CahierDeTextes"("enseignantId");

-- CreateIndex
CREATE INDEX "CahierDeTextes_classeId_idx" ON "CahierDeTextes"("classeId");

-- CreateIndex
CREATE INDEX "CahierDeTextes_matiereId_idx" ON "CahierDeTextes"("matiereId");

-- CreateIndex
CREATE INDEX "CahierDeTextes_dateCours_idx" ON "CahierDeTextes"("dateCours");

-- CreateIndex
CREATE INDEX "ConseilDeClasse_tenantId_idx" ON "ConseilDeClasse"("tenantId");

-- CreateIndex
CREATE INDEX "ConseilDeClasse_classeId_idx" ON "ConseilDeClasse"("classeId");

-- CreateIndex
CREATE INDEX "ConseilDeClasse_anneeScolaireId_idx" ON "ConseilDeClasse"("anneeScolaireId");

-- CreateIndex
CREATE UNIQUE INDEX "ConseilDeClasse_tenantId_anneeScolaireId_classeId_periodeIn_key" ON "ConseilDeClasse"("tenantId", "anneeScolaireId", "classeId", "periodeIndex");

-- CreateIndex
CREATE INDEX "ConseilParticipant_conseilId_idx" ON "ConseilParticipant"("conseilId");

-- CreateIndex
CREATE UNIQUE INDEX "ConseilParticipant_conseilId_staffId_key" ON "ConseilParticipant"("conseilId", "staffId");

-- CreateIndex
CREATE INDEX "HeureEnseignee_tenantId_idx" ON "HeureEnseignee"("tenantId");

-- CreateIndex
CREATE INDEX "HeureEnseignee_enseignantId_idx" ON "HeureEnseignee"("enseignantId");

-- CreateIndex
CREATE INDEX "HeureEnseignee_date_idx" ON "HeureEnseignee"("date");

-- CreateIndex
CREATE INDEX "HeureEnseignee_validee_idx" ON "HeureEnseignee"("validee");

-- CreateIndex
CREATE INDEX "Message_tenantId_idx" ON "Message"("tenantId");

-- CreateIndex
CREATE INDEX "Message_expediteurId_idx" ON "Message"("expediteurId");

-- CreateIndex
CREATE INDEX "Message_destinataireStaffId_idx" ON "Message"("destinataireStaffId");

-- CreateIndex
CREATE INDEX "Message_destinataireUserId_idx" ON "Message"("destinataireUserId");

-- CreateIndex
CREATE INDEX "Message_lu_idx" ON "Message"("lu");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bulletin_qrCodeHash_key" ON "Bulletin"("qrCodeHash");

-- CreateIndex
CREATE INDEX "EmploiDuTemps_salleId_idx" ON "EmploiDuTemps"("salleId");

-- AddForeignKey
ALTER TABLE "EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salle" ADD CONSTRAINT "Salle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendrierScolaire" ADD CONSTRAINT "CalendrierScolaire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendrierScolaire" ADD CONSTRAINT "CalendrierScolaire_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTextes" ADD CONSTRAINT "CahierDeTextes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTextes" ADD CONSTRAINT "CahierDeTextes_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTextes" ADD CONSTRAINT "CahierDeTextes_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTextes" ADD CONSTRAINT "CahierDeTextes_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTextes" ADD CONSTRAINT "CahierDeTextes_emploiDuTempsId_fkey" FOREIGN KEY ("emploiDuTempsId") REFERENCES "EmploiDuTemps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConseilDeClasse" ADD CONSTRAINT "ConseilDeClasse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConseilDeClasse" ADD CONSTRAINT "ConseilDeClasse_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConseilDeClasse" ADD CONSTRAINT "ConseilDeClasse_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConseilDeClasse" ADD CONSTRAINT "ConseilDeClasse_presidentId_fkey" FOREIGN KEY ("presidentId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConseilParticipant" ADD CONSTRAINT "ConseilParticipant_conseilId_fkey" FOREIGN KEY ("conseilId") REFERENCES "ConseilDeClasse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConseilParticipant" ADD CONSTRAINT "ConseilParticipant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeureEnseignee" ADD CONSTRAINT "HeureEnseignee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeureEnseignee" ADD CONSTRAINT "HeureEnseignee_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeureEnseignee" ADD CONSTRAINT "HeureEnseignee_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeureEnseignee" ADD CONSTRAINT "HeureEnseignee_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_expediteurId_fkey" FOREIGN KEY ("expediteurId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_destinataireStaffId_fkey" FOREIGN KEY ("destinataireStaffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_destinataireUserId_fkey" FOREIGN KEY ("destinataireUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
