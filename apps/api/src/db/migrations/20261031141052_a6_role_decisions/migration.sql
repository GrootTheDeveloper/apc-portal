-- CreateEnum
CREATE TYPE "RoleDecisionAction" AS ENUM ('GRANT', 'REVOKE');

-- CreateEnum
CREATE TYPE "RoleDecisionStatus" AS ENUM ('PENDING', 'EXECUTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "revokeReason" TEXT;

-- CreateTable
CREATE TABLE "role_decisions" (
    "id" TEXT NOT NULL,
    "action" "RoleDecisionAction" NOT NULL,
    "role" "Role" NOT NULL,
    "userId" TEXT NOT NULL,
    "userRoleId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "RoleDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT NOT NULL,
    "executedById" TEXT,
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_decisions_status_idx" ON "role_decisions"("status");

-- CreateIndex
CREATE INDEX "role_decisions_userId_idx" ON "role_decisions"("userId");

-- AddForeignKey
ALTER TABLE "role_decisions" ADD CONSTRAINT "role_decisions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_decisions" ADD CONSTRAINT "role_decisions_userRoleId_fkey" FOREIGN KEY ("userRoleId") REFERENCES "user_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_decisions" ADD CONSTRAINT "role_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_decisions" ADD CONSTRAINT "role_decisions_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
