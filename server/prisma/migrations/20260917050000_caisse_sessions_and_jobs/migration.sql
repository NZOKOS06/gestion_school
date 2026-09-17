-- Migration: CaisseSession, PaiementAnnulation, BulletinJob, RelanceLog, FacturationJob, Paiement.caisseSessionId

-- 1. AlterTable Paiement
ALTER TABLE "Paiement" ADD COLUMN IF NOT EXISTS "caisseSessionId" TEXT;

-- 2. CreateTable CaisseSession
CREATE TABLE IF NOT EXISTS "CaisseSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caissierId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ouverte',
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateCloture" TIMESTAMP(3),
    "fondDeCaisse" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "montantTheorique" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "montantReel" DECIMAL(12,2),
    "ecart" DECIMAL(12,2),
    "justificationEcart" TEXT,
    "billetterie" JSONB,
    "nombrePaiements" INTEGER NOT NULL DEFAULT 0,
    "totalEncaisse" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalDecaisse" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "notesCloture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaisseSession_pkey" PRIMARY KEY ("id")
);

-- 3. CreateTable PaiementAnnulation
CREATE TABLE IF NOT EXISTS "PaiementAnnulation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paiementId" TEXT NOT NULL,
    "montantAnnule" DECIMAL(12,2) NOT NULL,
    "numeroRecuRef" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "numeroAvoir" INTEGER,
    "annulePar" TEXT NOT NULL,
    "autorisePar" TEXT,
    "snapshotPaiement" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementAnnulation_pkey" PRIMARY KEY ("id")
);

-- 4. CreateTable BulletinJob
CREATE TABLE IF NOT EXISTS "BulletinJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'pending',
    "progression" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulletinJob_pkey" PRIMARY KEY ("id")
);

-- 5. CreateTable RelanceLog
CREATE TABLE IF NOT EXISTS "RelanceLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "parentTel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelanceLog_pkey" PRIMARY KEY ("id")
);

-- 6. CreateTable FacturationJob
CREATE TABLE IF NOT EXISTS "FacturationJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "tauxIndexation" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "nbEleves" INTEGER NOT NULL,
    "totalGenere" DECIMAL(14,2) NOT NULL,
    "declenchePar" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacturationJob_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Paiement_caisseSessionId_idx" ON "Paiement"("caisseSessionId");

CREATE INDEX IF NOT EXISTS "CaisseSession_tenantId_idx" ON "CaisseSession"("tenantId");
CREATE INDEX IF NOT EXISTS "CaisseSession_caissierId_idx" ON "CaisseSession"("caissierId");
CREATE INDEX IF NOT EXISTS "CaisseSession_dateOuverture_idx" ON "CaisseSession"("dateOuverture");
CREATE INDEX IF NOT EXISTS "CaisseSession_statut_idx" ON "CaisseSession"("statut");

CREATE INDEX IF NOT EXISTS "PaiementAnnulation_tenantId_idx" ON "PaiementAnnulation"("tenantId");
CREATE INDEX IF NOT EXISTS "PaiementAnnulation_paiementId_idx" ON "PaiementAnnulation"("paiementId");
CREATE INDEX IF NOT EXISTS "PaiementAnnulation_createdAt_idx" ON "PaiementAnnulation"("createdAt");

CREATE INDEX IF NOT EXISTS "BulletinJob_tenantId_idx" ON "BulletinJob"("tenantId");
CREATE INDEX IF NOT EXISTS "BulletinJob_statut_idx" ON "BulletinJob"("statut");
CREATE INDEX IF NOT EXISTS "BulletinJob_createdAt_idx" ON "BulletinJob"("createdAt");

CREATE INDEX IF NOT EXISTS "RelanceLog_tenantId_idx" ON "RelanceLog"("tenantId");
CREATE INDEX IF NOT EXISTS "RelanceLog_eleveId_idx" ON "RelanceLog"("eleveId");
CREATE INDEX IF NOT EXISTS "RelanceLog_type_idx" ON "RelanceLog"("type");
CREATE INDEX IF NOT EXISTS "RelanceLog_createdAt_idx" ON "RelanceLog"("createdAt");

CREATE INDEX IF NOT EXISTS "FacturationJob_tenantId_idx" ON "FacturationJob"("tenantId");
CREATE INDEX IF NOT EXISTS "FacturationJob_anneeScolaireId_idx" ON "FacturationJob"("anneeScolaireId");
CREATE INDEX IF NOT EXISTS "FacturationJob_createdAt_idx" ON "FacturationJob"("createdAt");

-- Foreign keys with idempotency guards
DO $$ BEGIN
  ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_caisseSessionId_fkey" FOREIGN KEY ("caisseSessionId") REFERENCES "CaisseSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CaisseSession" ADD CONSTRAINT "CaisseSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CaisseSession" ADD CONSTRAINT "CaisseSession_caissierId_fkey" FOREIGN KEY ("caissierId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaiementAnnulation" ADD CONSTRAINT "PaiementAnnulation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BulletinJob" ADD CONSTRAINT "BulletinJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RelanceLog" ADD CONSTRAINT "RelanceLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RelanceLog" ADD CONSTRAINT "RelanceLog_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "Eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FacturationJob" ADD CONSTRAINT "FacturationJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FacturationJob" ADD CONSTRAINT "FacturationJob_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
