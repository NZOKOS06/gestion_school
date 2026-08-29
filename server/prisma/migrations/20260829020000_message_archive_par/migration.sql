-- Migration: Add archivePar column to Message table for soft-archive feature
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "archivePar" TEXT;
CREATE INDEX IF NOT EXISTS "Message_archivePar_idx" ON "Message"("archivePar");
