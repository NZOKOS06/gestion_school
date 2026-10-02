-- Portail parent : activation par tuteur, mot de passe provisoire, dérogation notes, annonces

ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'annonce';

ALTER TABLE "User" ADD COLUMN "portailActif" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Comportement conservé pour les écoles qui avaient déjà le module Parents actif
UPDATE "User" u
SET "portailActif" = true
FROM "TenantConfig" c
WHERE c."tenantId" = u."tenantId" AND c."moduleParents" = true AND u."passwordHash" IS NOT NULL;

ALTER TABLE "Inscription" ADD COLUMN "derogationNotes" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inscription" ADD COLUMN "motifDerogationNotes" TEXT;

CREATE TABLE "Annonce" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "cible" TEXT NOT NULL DEFAULT 'tous',
    "cibleValeur" TEXT,
    "auteurId" TEXT NOT NULL,
    "nbDestinataires" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Annonce_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Annonce_tenantId_createdAt_idx" ON "Annonce"("tenantId", "createdAt");
ALTER TABLE "Annonce" ADD CONSTRAINT "Annonce_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Annonce" ADD CONSTRAINT "Annonce_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AnnonceDestinataire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "luLe" TIMESTAMP(3),
    CONSTRAINT "AnnonceDestinataire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnnonceDestinataire_annonceId_userId_key" ON "AnnonceDestinataire"("annonceId", "userId");
CREATE INDEX "AnnonceDestinataire_tenantId_userId_idx" ON "AnnonceDestinataire"("tenantId", "userId");
ALTER TABLE "AnnonceDestinataire" ADD CONSTRAINT "AnnonceDestinataire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnonceDestinataire" ADD CONSTRAINT "AnnonceDestinataire_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "Annonce"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnonceDestinataire" ADD CONSTRAINT "AnnonceDestinataire_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
