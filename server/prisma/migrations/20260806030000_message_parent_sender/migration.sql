-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "expediteurId" DROP NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "expediteurUserId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_expediteurUserId_idx" ON "Message"("expediteurUserId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_expediteurUserId_fkey"
    FOREIGN KEY ("expediteurUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
