-- AlterTable : l'enum AuditAction ne couvrait qu'une partie des actions journalisées
ALTER TABLE "AuditLog" ALTER COLUMN "action" SET DATA TYPE TEXT;

-- DropEnum
DROP TYPE "AuditAction";
