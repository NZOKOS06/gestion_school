-- Session de travail par défaut : 15 h (900 min)
ALTER TABLE "TenantConfig" ALTER COLUMN "dureeSessionMinutes" SET DEFAULT 900;

-- Écoles restées sur l'ancien défaut (8 h) → 15 h
UPDATE "TenantConfig" SET "dureeSessionMinutes" = 900 WHERE "dureeSessionMinutes" = 480;
