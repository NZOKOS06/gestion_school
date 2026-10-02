-- Catégories de recettes / dépenses gérées par l'école, catalogue d'articles, ventes et recettes diverses

CREATE TABLE "CategorieFinance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "systeme" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CategorieFinance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CategorieFinance_tenantId_type_nom_key" ON "CategorieFinance"("tenantId", "type", "nom");
CREATE INDEX "CategorieFinance_tenantId_type_idx" ON "CategorieFinance"("tenantId", "type");
ALTER TABLE "CategorieFinance" ADD CONSTRAINT "CategorieFinance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Depense" ADD COLUMN "categorieId" TEXT;
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategorieFinance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ArticleCatalogue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "prix" DECIMAL(12,2) NOT NULL,
    "categorieId" TEXT,
    "gereStock" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArticleCatalogue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArticleCatalogue_tenantId_nom_key" ON "ArticleCatalogue"("tenantId", "nom");
CREATE INDEX "ArticleCatalogue_tenantId_idx" ON "ArticleCatalogue"("tenantId");
ALTER TABLE "ArticleCatalogue" ADD CONSTRAINT "ArticleCatalogue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleCatalogue" ADD CONSTRAINT "ArticleCatalogue_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategorieFinance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Vente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "dateVente" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inscriptionId" TEXT,
    "clientNom" TEXT,
    "montantTotal" DECIMAL(12,2) NOT NULL,
    "modePaiement" "ModePaiement" NOT NULL,
    "reference" TEXT,
    "vendeurId" TEXT NOT NULL,
    "caisseSessionId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'payee',
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vente_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Vente_tenantId_numero_key" ON "Vente"("tenantId", "numero");
CREATE INDEX "Vente_tenantId_dateVente_idx" ON "Vente"("tenantId", "dateVente");
CREATE INDEX "Vente_caisseSessionId_idx" ON "Vente"("caisseSessionId");
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_vendeurId_fkey" FOREIGN KEY ("vendeurId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_caisseSessionId_fkey" FOREIGN KEY ("caisseSessionId") REFERENCES "CaisseSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VenteLigne" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "venteId" TEXT NOT NULL,
    "articleId" TEXT,
    "categorieId" TEXT,
    "libelle" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "prixUnitaire" DECIMAL(12,2) NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "VenteLigne_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VenteLigne_tenantId_idx" ON "VenteLigne"("tenantId");
CREATE INDEX "VenteLigne_venteId_idx" ON "VenteLigne"("venteId");
ALTER TABLE "VenteLigne" ADD CONSTRAINT "VenteLigne_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenteLigne" ADD CONSTRAINT "VenteLigne_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenteLigne" ADD CONSTRAINT "VenteLigne_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "ArticleCatalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VenteLigne" ADD CONSTRAINT "VenteLigne_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategorieFinance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
