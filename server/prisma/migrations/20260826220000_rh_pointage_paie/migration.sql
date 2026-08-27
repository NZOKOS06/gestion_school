-- RH: pointage enseignant + paie (3 modes)

CREATE TYPE "MethodePaie" AS ENUM ('mensuel', 'horaire', 'mixte');
CREATE TYPE "StatutPointageSession" AS ENUM ('prevue', 'en_cours', 'terminee', 'absente', 'annulee');
CREATE TYPE "SourcePointage" AS ENUM ('manuel', 'biometrique', 'import');
CREATE TYPE "StatutPeriodePaie" AS ENUM ('ouverte', 'calculee', 'validee', 'payee');
CREATE TYPE "StatutBulletinPaie" AS ENUM ('brouillon', 'valide', 'paye');

ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "modulePointagePersonnel" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "modulePaie" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "methodePaie" "MethodePaie" NOT NULL DEFAULT 'mensuel';
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "pointageToleranceMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "paieJourCloture" INTEGER NOT NULL DEFAULT 25;

ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "salaireMensuel" DECIMAL(12,2);
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "deviceBiometricId" TEXT;

ALTER TABLE "HeureEnseignee" ADD COLUMN IF NOT EXISTS "pointageSessionId" TEXT;

CREATE TABLE "PointageSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "emploiDuTempsId" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "salleId" TEXT,
    "date" DATE NOT NULL,
    "heurePrevueDebut" TEXT NOT NULL,
    "heurePrevueFin" TEXT NOT NULL,
    "heureArrivee" TIMESTAMP(3),
    "heureDepart" TIMESTAMP(3),
    "statut" "StatutPointageSession" NOT NULL DEFAULT 'prevue',
    "sourceArrivee" "SourcePointage",
    "sourceDepart" "SourcePointage",
    "saisiParId" TEXT,
    "commentaire" TEXT,
    "dureeHeures" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointageSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PeriodePaie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "mois" INTEGER NOT NULL,
    "anneeCivile" INTEGER NOT NULL,
    "statut" "StatutPeriodePaie" NOT NULL DEFAULT 'ouverte',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodePaie_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BulletinPaie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodePaieId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "montantFixe" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "heuresValidees" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "montantHoraire" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montantTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "detailJson" JSONB,
    "statut" "StatutBulletinPaie" NOT NULL DEFAULT 'brouillon',
    "depenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletinPaie_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PointageSession_tenantId_emploiDuTempsId_date_key" ON "PointageSession"("tenantId", "emploiDuTempsId", "date");
CREATE INDEX "PointageSession_tenantId_idx" ON "PointageSession"("tenantId");
CREATE INDEX "PointageSession_date_idx" ON "PointageSession"("date");
CREATE INDEX "PointageSession_enseignantId_idx" ON "PointageSession"("enseignantId");
CREATE INDEX "PointageSession_statut_idx" ON "PointageSession"("statut");

CREATE UNIQUE INDEX "PeriodePaie_tenantId_anneeScolaireId_mois_anneeCivile_key" ON "PeriodePaie"("tenantId", "anneeScolaireId", "mois", "anneeCivile");
CREATE INDEX "PeriodePaie_tenantId_idx" ON "PeriodePaie"("tenantId");
CREATE INDEX "PeriodePaie_anneeScolaireId_idx" ON "PeriodePaie"("anneeScolaireId");

CREATE UNIQUE INDEX "BulletinPaie_periodePaieId_staffId_key" ON "BulletinPaie"("periodePaieId", "staffId");
CREATE INDEX "BulletinPaie_tenantId_idx" ON "BulletinPaie"("tenantId");
CREATE INDEX "BulletinPaie_staffId_idx" ON "BulletinPaie"("staffId");

CREATE UNIQUE INDEX "HeureEnseignee_pointageSessionId_key" ON "HeureEnseignee"("pointageSessionId");

ALTER TABLE "HeureEnseignee" ADD CONSTRAINT "HeureEnseignee_pointageSessionId_fkey" FOREIGN KEY ("pointageSessionId") REFERENCES "PointageSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PointageSession" ADD CONSTRAINT "PointageSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointageSession" ADD CONSTRAINT "PointageSession_emploiDuTempsId_fkey" FOREIGN KEY ("emploiDuTempsId") REFERENCES "EmploiDuTemps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointageSession" ADD CONSTRAINT "PointageSession_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointageSession" ADD CONSTRAINT "PointageSession_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointageSession" ADD CONSTRAINT "PointageSession_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointageSession" ADD CONSTRAINT "PointageSession_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PointageSession" ADD CONSTRAINT "PointageSession_saisiParId_fkey" FOREIGN KEY ("saisiParId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PeriodePaie" ADD CONSTRAINT "PeriodePaie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeriodePaie" ADD CONSTRAINT "PeriodePaie_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BulletinPaie" ADD CONSTRAINT "BulletinPaie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BulletinPaie" ADD CONSTRAINT "BulletinPaie_periodePaieId_fkey" FOREIGN KEY ("periodePaieId") REFERENCES "PeriodePaie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BulletinPaie" ADD CONSTRAINT "BulletinPaie_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BulletinPaie" ADD CONSTRAINT "BulletinPaie_depenseId_fkey" FOREIGN KEY ("depenseId") REFERENCES "Depense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
