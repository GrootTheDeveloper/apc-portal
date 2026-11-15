-- DropForeignKey
ALTER TABLE "application_status_histories" DROP CONSTRAINT "application_status_histories_changedById_fkey";

-- AlterTable
ALTER TABLE "application_status_histories" ALTER COLUMN "changedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "application_status_histories" ADD CONSTRAINT "application_status_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
