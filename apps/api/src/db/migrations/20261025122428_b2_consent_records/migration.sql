-- CreateEnum
CREATE TYPE "ConsentSubjectType" AS ENUM ('APPLICATION', 'EVENT_REGISTRATION', 'USER');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('RECRUITMENT_PROCESSING', 'EVENT_REGISTRATION', 'PUBLIC_NAME', 'PUBLIC_PHOTO', 'PUBLIC_PROFILE');

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "subjectType" "ConsentSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "policyVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_records_subjectType_subjectId_purpose_idx" ON "consent_records"("subjectType", "subjectId", "purpose");
