-- CreateTable
CREATE TABLE "EnseignantClasseQuittee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "motif" TEXT,
    "dateSortie" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnseignantClasseQuittee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnseignantClasseQuittee_tenantId_idx" ON "EnseignantClasseQuittee"("tenantId");

-- CreateIndex
CREATE INDEX "EnseignantClasseQuittee_classeId_idx" ON "EnseignantClasseQuittee"("classeId");

-- CreateIndex
CREATE UNIQUE INDEX "EnseignantClasseQuittee_enseignantId_classeId_key" ON "EnseignantClasseQuittee"("enseignantId", "classeId");

-- AddForeignKey
ALTER TABLE "EnseignantClasseQuittee" ADD CONSTRAINT "EnseignantClasseQuittee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnseignantClasseQuittee" ADD CONSTRAINT "EnseignantClasseQuittee_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnseignantClasseQuittee" ADD CONSTRAINT "EnseignantClasseQuittee_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
