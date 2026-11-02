-- AlterTable
ALTER TABLE "membership_applications" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "membership_applications_idempotencyKey_key" ON "membership_applications"("idempotencyKey");
