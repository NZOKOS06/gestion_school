-- Grille horaire de l'établissement (créneaux de cours, pauses, récréations)
CREATE TABLE "CreneauHoraire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycle" "CycleEnseignement",
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'cours',
    "libelle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreneauHoraire_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreneauHoraire_tenantId_idx" ON "CreneauHoraire"("tenantId");
CREATE INDEX "CreneauHoraire_tenantId_cycle_idx" ON "CreneauHoraire"("tenantId", "cycle");

ALTER TABLE "CreneauHoraire" ADD CONSTRAINT "CreneauHoraire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
