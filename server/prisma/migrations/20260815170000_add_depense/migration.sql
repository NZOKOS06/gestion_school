-- CreateTable
CREATE TABLE "Depense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "motif" TEXT NOT NULL,
    "reference" TEXT,
    "dateDepense" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saisieParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Depense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Depense_tenantId_idx" ON "Depense"("tenantId");
CREATE INDEX "Depense_dateDepense_idx" ON "Depense"("dateDepense");
CREATE INDEX "Depense_categorie_idx" ON "Depense"("categorie");

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_saisieParId_fkey" FOREIGN KEY ("saisieParId") REFERENCES "Staff"("id") ON UPDATE CASCADE;
