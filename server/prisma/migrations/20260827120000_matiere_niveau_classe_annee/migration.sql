-- CreateTable MatiereNiveauAnnee
CREATE TABLE "MatiereNiveauAnnee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "niveauOfficielId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "coefficient" INTEGER NOT NULL DEFAULT 1,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatiereNiveauAnnee_pkey" PRIMARY KEY ("id")
);

-- CreateTable MatiereClasseAnnee
CREATE TABLE "MatiereClasseAnnee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "coefficient" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatiereClasseAnnee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatiereNiveauAnnee_anneeScolaireId_niveauOfficielId_matiereId_key" ON "MatiereNiveauAnnee"("anneeScolaireId", "niveauOfficielId", "matiereId");
CREATE INDEX "MatiereNiveauAnnee_tenantId_idx" ON "MatiereNiveauAnnee"("tenantId");
CREATE INDEX "MatiereNiveauAnnee_anneeScolaireId_idx" ON "MatiereNiveauAnnee"("anneeScolaireId");
CREATE INDEX "MatiereNiveauAnnee_niveauOfficielId_idx" ON "MatiereNiveauAnnee"("niveauOfficielId");

-- CreateIndex
CREATE UNIQUE INDEX "MatiereClasseAnnee_classeId_matiereId_key" ON "MatiereClasseAnnee"("classeId", "matiereId");
CREATE INDEX "MatiereClasseAnnee_tenantId_idx" ON "MatiereClasseAnnee"("tenantId");
CREATE INDEX "MatiereClasseAnnee_classeId_idx" ON "MatiereClasseAnnee"("classeId");

-- AddForeignKey
ALTER TABLE "MatiereNiveauAnnee" ADD CONSTRAINT "MatiereNiveauAnnee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatiereNiveauAnnee" ADD CONSTRAINT "MatiereNiveauAnnee_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatiereNiveauAnnee" ADD CONSTRAINT "MatiereNiveauAnnee_niveauOfficielId_fkey" FOREIGN KEY ("niveauOfficielId") REFERENCES "NiveauOfficiel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatiereNiveauAnnee" ADD CONSTRAINT "MatiereNiveauAnnee_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatiereClasseAnnee" ADD CONSTRAINT "MatiereClasseAnnee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatiereClasseAnnee" ADD CONSTRAINT "MatiereClasseAnnee_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatiereClasseAnnee" ADD CONSTRAINT "MatiereClasseAnnee_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;
