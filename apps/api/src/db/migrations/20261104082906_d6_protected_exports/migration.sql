-- CreateEnum
CREATE TYPE "ExportFileStatus" AS ENUM ('CREATING', 'READY', 'EXPIRED');

-- CreateTable
CREATE TABLE "export_files" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "downloaderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "ExportFileStatus" NOT NULL DEFAULT 'CREATING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "export_files_storageKey_key" ON "export_files"("storageKey");

-- CreateIndex
CREATE INDEX "export_files_downloaderId_status_expiresAt_idx" ON "export_files"("downloaderId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "export_files_status_expiresAt_idx" ON "export_files"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "export_files" ADD CONSTRAINT "export_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_files" ADD CONSTRAINT "export_files_downloaderId_fkey" FOREIGN KEY ("downloaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
