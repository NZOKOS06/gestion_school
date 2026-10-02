-- Paie programmée (jour de paie, rappel), retenues de pointage activables, pointage journalier

ALTER TABLE "TenantConfig" ADD COLUMN "paieJour" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "TenantConfig" ADD COLUMN "paieRappelJours" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "TenantConfig" ADD COLUMN "retenuesActives" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantConfig" ADD COLUMN "retenueMode" TEXT NOT NULL DEFAULT 'proportionnel';
ALTER TABLE "TenantConfig" ADD COLUMN "retenueForfaitRetard" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "TenantConfig" ADD COLUMN "retenueForfaitAbsence" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "TenantConfig" ADD COLUMN "retenueAbsencesJustifiees" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Staff" ADD COLUMN "heureArriveePrevue" TEXT;
ALTER TABLE "Staff" ADD COLUMN "heureDepartPrevue" TEXT;

ALTER TABLE "PeriodePaie" ADD COLUMN "ouverteParId" TEXT;
ALTER TABLE "PeriodePaie" ADD COLUMN "ouverteLe" TIMESTAMP(3);
ALTER TABLE "PeriodePaie" ADD CONSTRAINT "PeriodePaie_ouverteParId_fkey" FOREIGN KEY ("ouverteParId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BulletinPaie" ADD COLUMN "montantRetenues" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "PointageSession" ADD COLUMN "justifiee" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PointageJournalier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'present',
    "heureArrivee" TIMESTAMP(3),
    "heureDepart" TIMESTAMP(3),
    "justifie" BOOLEAN NOT NULL DEFAULT false,
    "motif" TEXT,
    "saisiParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PointageJournalier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PointageJournalier_staffId_date_key" ON "PointageJournalier"("staffId", "date");
CREATE INDEX "PointageJournalier_tenantId_date_idx" ON "PointageJournalier"("tenantId", "date");
ALTER TABLE "PointageJournalier" ADD CONSTRAINT "PointageJournalier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointageJournalier" ADD CONSTRAINT "PointageJournalier_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointageJournalier" ADD CONSTRAINT "PointageJournalier_saisiParId_fkey" FOREIGN KEY ("saisiParId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
