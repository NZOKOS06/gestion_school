-- AlterEnum StaffRole
ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'directeur_etudes';

-- CreateEnum TypeExamenCode
CREATE TYPE "TypeExamenCode" AS ENUM ('CEPE', 'BEPC', 'BAC_GENERAL', 'BAC_TECHNIQUE', 'CAP', 'BEP', 'BTS', 'CONCOURS_6E', 'AUTRE');

-- CreateEnum ResultatExamenStatut
CREATE TYPE "ResultatExamenStatut" AS ENUM ('admis', 'ajourne', 'refuse', 'en_attente');

-- CreateTable ReferentielVersion
CREATE TABLE "ReferentielVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferentielVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable NiveauOfficiel
CREATE TABLE "NiveauOfficiel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referentielVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "cycle" "CycleEnseignement" NOT NULL,
    "ordre" INTEGER NOT NULL,
    "ageIndicatif" INTEGER,
    "typeExamenSortie" "TypeExamenCode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NiveauOfficiel_pkey" PRIMARY KEY ("id")
);

-- CreateTable FiliereOfficielle
CREATE TABLE "FiliereOfficielle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referentielVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "cycle" "CycleEnseignement" NOT NULL DEFAULT 'lycee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiliereOfficielle_pkey" PRIMARY KEY ("id")
);

-- CreateTable PeriodeScolaire
CREATE TABLE "PeriodeScolaire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "dateEvaluationDebut" TIMESTAMP(3),
    "dateEvaluationFin" TIMESTAMP(3),
    "poids" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodeScolaire_pkey" PRIMARY KEY ("id")
);

-- AlterTable AnneeScolaire
ALTER TABLE "AnneeScolaire" ADD COLUMN IF NOT EXISTS "referentielVersionId" TEXT;

-- AlterTable Classe
ALTER TABLE "Classe" ADD COLUMN IF NOT EXISTS "niveauOfficielId" TEXT;
ALTER TABLE "Classe" ADD COLUMN IF NOT EXISTS "filiereOfficielleId" TEXT;

-- AlterTable Inscription
ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS "niveauCibleId" TEXT;
ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS "classeCibleId" TEXT;
ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS "motifDecision" TEXT;
ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS "resultatExamenId" TEXT;

-- CreateTable ExamenSession
CREATE TABLE "ExamenSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "typeExamen" "TypeExamenCode" NOT NULL,
    "libelle" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "centre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamenSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable ExamenCandidature
CREATE TABLE "ExamenCandidature" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "serieFiliere" TEXT,
    "numeroCandidat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamenCandidature_pkey" PRIMARY KEY ("id")
);

-- CreateTable ExamenNote
CREATE TABLE "ExamenNote" (
    "id" TEXT NOT NULL,
    "candidatureId" TEXT NOT NULL,
    "matiereLibelle" TEXT NOT NULL,
    "note" DECIMAL(5,2) NOT NULL,
    "coefficient" DECIMAL(5,2) NOT NULL DEFAULT 1,

    CONSTRAINT "ExamenNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable ResultatExamen
CREATE TABLE "ResultatExamen" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidatureId" TEXT NOT NULL,
    "statut" "ResultatExamenStatut" NOT NULL DEFAULT 'en_attente',
    "mention" TEXT,
    "numeroDiplome" TEXT,
    "moyenne" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultatExamen_pkey" PRIMARY KEY ("id")
);

-- Indexes & uniques
CREATE UNIQUE INDEX "ReferentielVersion_tenantId_code_key" ON "ReferentielVersion"("tenantId", "code");
CREATE INDEX "ReferentielVersion_tenantId_idx" ON "ReferentielVersion"("tenantId");

CREATE UNIQUE INDEX "NiveauOfficiel_referentielVersionId_code_key" ON "NiveauOfficiel"("referentielVersionId", "code");
CREATE INDEX "NiveauOfficiel_tenantId_idx" ON "NiveauOfficiel"("tenantId");
CREATE INDEX "NiveauOfficiel_cycle_idx" ON "NiveauOfficiel"("cycle");

CREATE UNIQUE INDEX "FiliereOfficielle_referentielVersionId_code_key" ON "FiliereOfficielle"("referentielVersionId", "code");
CREATE INDEX "FiliereOfficielle_tenantId_idx" ON "FiliereOfficielle"("tenantId");

CREATE UNIQUE INDEX "PeriodeScolaire_anneeScolaireId_index_key" ON "PeriodeScolaire"("anneeScolaireId", "index");
CREATE INDEX "PeriodeScolaire_tenantId_idx" ON "PeriodeScolaire"("tenantId");
CREATE INDEX "PeriodeScolaire_anneeScolaireId_idx" ON "PeriodeScolaire"("anneeScolaireId");

CREATE INDEX "AnneeScolaire_referentielVersionId_idx" ON "AnneeScolaire"("referentielVersionId");
CREATE INDEX "Classe_niveauOfficielId_idx" ON "Classe"("niveauOfficielId");

CREATE INDEX "ExamenSession_tenantId_idx" ON "ExamenSession"("tenantId");
CREATE INDEX "ExamenSession_anneeScolaireId_idx" ON "ExamenSession"("anneeScolaireId");
CREATE INDEX "ExamenSession_typeExamen_idx" ON "ExamenSession"("typeExamen");

CREATE UNIQUE INDEX "ExamenCandidature_sessionId_eleveId_key" ON "ExamenCandidature"("sessionId", "eleveId");
CREATE INDEX "ExamenCandidature_tenantId_idx" ON "ExamenCandidature"("tenantId");
CREATE INDEX "ExamenCandidature_eleveId_idx" ON "ExamenCandidature"("eleveId");

CREATE INDEX "ExamenNote_candidatureId_idx" ON "ExamenNote"("candidatureId");

CREATE UNIQUE INDEX "ResultatExamen_candidatureId_key" ON "ResultatExamen"("candidatureId");
CREATE INDEX "ResultatExamen_tenantId_idx" ON "ResultatExamen"("tenantId");
CREATE INDEX "ResultatExamen_statut_idx" ON "ResultatExamen"("statut");

-- Foreign keys
ALTER TABLE "ReferentielVersion" ADD CONSTRAINT "ReferentielVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NiveauOfficiel" ADD CONSTRAINT "NiveauOfficiel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NiveauOfficiel" ADD CONSTRAINT "NiveauOfficiel_referentielVersionId_fkey" FOREIGN KEY ("referentielVersionId") REFERENCES "ReferentielVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FiliereOfficielle" ADD CONSTRAINT "FiliereOfficielle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiliereOfficielle" ADD CONSTRAINT "FiliereOfficielle_referentielVersionId_fkey" FOREIGN KEY ("referentielVersionId") REFERENCES "ReferentielVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeriodeScolaire" ADD CONSTRAINT "PeriodeScolaire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeriodeScolaire" ADD CONSTRAINT "PeriodeScolaire_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnneeScolaire" ADD CONSTRAINT "AnneeScolaire_referentielVersionId_fkey" FOREIGN KEY ("referentielVersionId") REFERENCES "ReferentielVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Classe" ADD CONSTRAINT "Classe_niveauOfficielId_fkey" FOREIGN KEY ("niveauOfficielId") REFERENCES "NiveauOfficiel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_filiereOfficielleId_fkey" FOREIGN KEY ("filiereOfficielleId") REFERENCES "FiliereOfficielle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExamenSession" ADD CONSTRAINT "ExamenSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamenSession" ADD CONSTRAINT "ExamenSession_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamenCandidature" ADD CONSTRAINT "ExamenCandidature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamenCandidature" ADD CONSTRAINT "ExamenCandidature_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamenSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamenCandidature" ADD CONSTRAINT "ExamenCandidature_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "Eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamenNote" ADD CONSTRAINT "ExamenNote_candidatureId_fkey" FOREIGN KEY ("candidatureId") REFERENCES "ExamenCandidature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResultatExamen" ADD CONSTRAINT "ResultatExamen_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultatExamen" ADD CONSTRAINT "ResultatExamen_candidatureId_fkey" FOREIGN KEY ("candidatureId") REFERENCES "ExamenCandidature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_niveauCibleId_fkey" FOREIGN KEY ("niveauCibleId") REFERENCES "NiveauOfficiel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_classeCibleId_fkey" FOREIGN KEY ("classeCibleId") REFERENCES "Classe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_resultatExamenId_fkey" FOREIGN KEY ("resultatExamenId") REFERENCES "ResultatExamen"("id") ON DELETE SET NULL ON UPDATE CASCADE;
