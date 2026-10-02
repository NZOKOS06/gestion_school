CREATE TABLE "GroupeScolaire" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupeScolaire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroupeScolaire_nom_key" ON "GroupeScolaire"("nom");
ALTER TABLE "Tenant" ADD COLUMN "groupeId" TEXT;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "GroupeScolaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
