-- AlterTable
ALTER TABLE "recruitment_rounds" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "questions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "requirements" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "_DepartmentToRecruitmentRound" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DepartmentToRecruitmentRound_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DepartmentToRecruitmentRound_B_index" ON "_DepartmentToRecruitmentRound"("B");

-- AddForeignKey
ALTER TABLE "_DepartmentToRecruitmentRound" ADD CONSTRAINT "_DepartmentToRecruitmentRound_A_fkey" FOREIGN KEY ("A") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentToRecruitmentRound" ADD CONSTRAINT "_DepartmentToRecruitmentRound_B_fkey" FOREIGN KEY ("B") REFERENCES "recruitment_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
