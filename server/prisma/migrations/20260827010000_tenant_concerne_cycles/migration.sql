-- Cycles proposés par établissement (null = tous)
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "concerneCycles" JSONB;
