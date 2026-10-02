-- Bulletins : pondération devoirs/composition, détail enrichi par matière
ALTER TABLE "TenantConfig" ADD COLUMN "bulletinPonderation" TEXT NOT NULL DEFAULT 'coefficients';
ALTER TABLE "TenantConfig" ADD COLUMN "bulletinPoidsDevoirs" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "BulletinDetail" ADD COLUMN "coefficient" DECIMAL(5,2);
ALTER TABLE "BulletinDetail" ADD COLUMN "nonClasse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BulletinDetail" ADD COLUMN "rangMatiere" INTEGER;
ALTER TABLE "BulletinDetail" ADD COLUMN "moyenneClasse" DECIMAL(5,2);
ALTER TABLE "BulletinDetail" ADD COLUMN "moyenneMin" DECIMAL(5,2);
ALTER TABLE "BulletinDetail" ADD COLUMN "moyenneMax" DECIMAL(5,2);
ALTER TABLE "BulletinDetail" ADD COLUMN "appreciation" TEXT;

ALTER TABLE "TenantConfig" ADD COLUMN "documentsConfig" JSONB;
