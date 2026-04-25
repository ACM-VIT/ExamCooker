-- AlterTable
ALTER TABLE "PastPaper" ADD COLUMN "questionPaperId" STRING;

-- CreateIndex
CREATE UNIQUE INDEX "PastPaper_questionPaperId_key" ON "PastPaper"("questionPaperId");

-- AddForeignKey
ALTER TABLE "PastPaper"
ADD CONSTRAINT "PastPaper_questionPaperId_fkey"
FOREIGN KEY ("questionPaperId") REFERENCES "PastPaper"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
