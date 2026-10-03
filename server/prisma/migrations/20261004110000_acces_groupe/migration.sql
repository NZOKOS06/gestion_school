ALTER TABLE "Staff" ADD COLUMN "origineStaffId" TEXT;

CREATE TABLE "GroupeAcces" (
    "id" TEXT NOT NULL,
    "groupeId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupeAcces_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroupeAcces_groupeId_staffId_key" ON "GroupeAcces"("groupeId", "staffId");
CREATE INDEX "GroupeAcces_staffId_idx" ON "GroupeAcces"("staffId");
ALTER TABLE "GroupeAcces" ADD CONSTRAINT "GroupeAcces_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "GroupeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupeAcces" ADD CONSTRAINT "GroupeAcces_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
