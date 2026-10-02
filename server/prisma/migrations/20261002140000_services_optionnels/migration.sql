-- Services optionnels payants (cantine, garderie, crèche, TD…) : remplace les champs cantine dédiés

CREATE TABLE "ServiceOptionnel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "tarif" DECIMAL(12,2) NOT NULL,
    "periodicite" TEXT NOT NULL DEFAULT 'mensuelle',
    "cycles" JSONB,
    "classeIds" JSONB,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceOptionnel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceOptionnel_tenantId_nom_key" ON "ServiceOptionnel"("tenantId", "nom");
CREATE INDEX "ServiceOptionnel_tenantId_idx" ON "ServiceOptionnel"("tenantId");
ALTER TABLE "ServiceOptionnel" ADD CONSTRAINT "ServiceOptionnel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SouscriptionService" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "tarifApplique" DECIMAL(12,2) NOT NULL,
    "tarifSpecial" BOOLEAN NOT NULL DEFAULT false,
    "motifTarifSpecial" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SouscriptionService_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SouscriptionService_inscriptionId_serviceId_key" ON "SouscriptionService"("inscriptionId", "serviceId");
CREATE INDEX "SouscriptionService_tenantId_idx" ON "SouscriptionService"("tenantId");
CREATE INDEX "SouscriptionService_serviceId_idx" ON "SouscriptionService"("serviceId");
ALTER TABLE "SouscriptionService" ADD CONSTRAINT "SouscriptionService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SouscriptionService" ADD CONSTRAINT "SouscriptionService_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SouscriptionService" ADD CONSTRAINT "SouscriptionService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceOptionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Echeance" ADD COLUMN "souscriptionServiceId" TEXT;
CREATE INDEX "Echeance_souscriptionServiceId_idx" ON "Echeance"("souscriptionServiceId");
ALTER TABLE "Echeance" ADD CONSTRAINT "Echeance_souscriptionServiceId_fkey" FOREIGN KEY ("souscriptionServiceId") REFERENCES "SouscriptionService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise des données cantine (lot précédent) vers le catalogue
INSERT INTO "ServiceOptionnel" ("id", "tenantId", "nom", "tarif", "periodicite", "actif", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "tenantId", 'Cantine', "tarifCantine", "cantinePeriodicite", "cantineActive", NOW(), NOW()
FROM "TenantConfig"
WHERE "cantineActive" = true OR "tarifCantine" > 0;

INSERT INTO "SouscriptionService" ("id", "tenantId", "inscriptionId", "serviceId", "tarifApplique", "actif", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, i."tenantId", i."id", s."id", COALESCE(i."tarifCantineApplique", s."tarif"), i."cantine", NOW(), NOW()
FROM "Inscription" i
JOIN "ServiceOptionnel" s ON s."tenantId" = i."tenantId" AND s."nom" = 'Cantine'
WHERE i."cantine" = true
   OR EXISTS (SELECT 1 FROM "Echeance" e WHERE e."inscriptionId" = i."id" AND e."categorie" = 'cantine');

UPDATE "Echeance" e
SET "souscriptionServiceId" = ss."id", "categorie" = 'service'
FROM "SouscriptionService" ss
JOIN "ServiceOptionnel" s ON s."id" = ss."serviceId" AND s."nom" = 'Cantine'
WHERE e."inscriptionId" = ss."inscriptionId" AND e."categorie" = 'cantine';

ALTER TABLE "TenantConfig" DROP COLUMN "cantineActive";
ALTER TABLE "TenantConfig" DROP COLUMN "cantinePeriodicite";
ALTER TABLE "TenantConfig" DROP COLUMN "tarifCantine";
ALTER TABLE "Inscription" DROP COLUMN "cantine";
ALTER TABLE "Inscription" DROP COLUMN "tarifCantineApplique";
