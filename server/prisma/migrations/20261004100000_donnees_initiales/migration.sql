ALTER TABLE "TenantConfig" ADD COLUMN "donneesInitialesAt" TIMESTAMP(3);
-- Les écoles existantes sont déjà initialisées : on ne leur recrée rien
UPDATE "TenantConfig" SET "donneesInitialesAt" = NOW();
