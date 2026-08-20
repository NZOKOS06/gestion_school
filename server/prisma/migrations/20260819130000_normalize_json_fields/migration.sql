-- AlterTable
ALTER TABLE "Bulletin" DROP COLUMN "notesDetaillees";

-- AlterTable
ALTER TABLE "TenantConfig" DROP COLUMN "ipWhitelist",
DROP COLUMN "joursEcole";

-- CreateTable
CREATE TABLE "TenantJourEcole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jour" TEXT NOT NULL,

    CONSTRAINT "TenantJourEcole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantIpWhitelist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,

    CONSTRAINT "TenantIpWhitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulletinDetail" (
    "id" TEXT NOT NULL,
    "bulletinId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "moyenne" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "BulletinDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantJourEcole_tenantId_jour_key" ON "TenantJourEcole"("tenantId", "jour");

-- CreateIndex
CREATE UNIQUE INDEX "TenantIpWhitelist_tenantId_ip_key" ON "TenantIpWhitelist"("tenantId", "ip");

-- CreateIndex
CREATE UNIQUE INDEX "BulletinDetail_bulletinId_matiereId_key" ON "BulletinDetail"("bulletinId", "matiereId");

-- AddForeignKey
ALTER TABLE "TenantJourEcole" ADD CONSTRAINT "TenantJourEcole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantConfig"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantIpWhitelist" ADD CONSTRAINT "TenantIpWhitelist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantConfig"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinDetail" ADD CONSTRAINT "BulletinDetail_bulletinId_fkey" FOREIGN KEY ("bulletinId") REFERENCES "Bulletin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinDetail" ADD CONSTRAINT "BulletinDetail_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
