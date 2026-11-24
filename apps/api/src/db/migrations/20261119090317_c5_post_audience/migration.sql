-- CreateEnum
CREATE TYPE "PostAudience" AS ENUM ('ALL', 'DEPARTMENT', 'ROLES');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "audience" "PostAudience",
ADD COLUMN     "audienceDepartmentId" TEXT,
ADD COLUMN     "audienceRoles" "Role"[] DEFAULT ARRAY[]::"Role"[];

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_audienceDepartmentId_fkey" FOREIGN KEY ("audienceDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
