-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "warnedForExpiresAt" TIMESTAMP(3),
ADD COLUMN     "warnedLevel" INTEGER;
