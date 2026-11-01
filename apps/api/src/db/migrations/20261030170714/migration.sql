/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `membership_applications` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "membership_applications" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "membership_applications_idempotencyKey_key" ON "membership_applications"("idempotencyKey");
