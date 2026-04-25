-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('CAT_1', 'CAT_2', 'FAT', 'MODEL_CAT_1', 'MODEL_CAT_2', 'MODEL_FAT', 'MID', 'QUIZ', 'CIA', 'OTHER');

-- CreateEnum
CREATE TYPE "Semester" AS ENUM ('FALL', 'WINTER', 'SUMMER', 'WEEKEND', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Campus" AS ENUM ('VELLORE', 'CHENNAI', 'AP', 'BHOPAL', 'BANGALORE', 'MAURITIUS');

-- CreateTable
CREATE TABLE "Course" (
    "id" STRING NOT NULL,
    "code" STRING NOT NULL,
    "title" STRING NOT NULL,
    "aliases" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE INDEX "Course_title_idx" ON "Course"("title");

-- AlterTable
ALTER TABLE "Note" ADD COLUMN "courseId" STRING;

-- CreateIndex
CREATE INDEX "Note_courseId_idx" ON "Note"("courseId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "PastPaper" ADD COLUMN "courseId" STRING;
ALTER TABLE "PastPaper" ADD COLUMN "examType" "ExamType";
ALTER TABLE "PastPaper" ADD COLUMN "slot" STRING;
ALTER TABLE "PastPaper" ADD COLUMN "year" INT4;
ALTER TABLE "PastPaper" ADD COLUMN "semester" "Semester" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "PastPaper" ADD COLUMN "campus" "Campus" NOT NULL DEFAULT 'VELLORE';
ALTER TABLE "PastPaper" ADD COLUMN "hasAnswerKey" BOOL NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "PastPaper_courseId_examType_idx" ON "PastPaper"("courseId", "examType");

-- CreateIndex
CREATE INDEX "PastPaper_courseId_year_idx" ON "PastPaper"("courseId", "year");

-- CreateIndex
CREATE INDEX "PastPaper_courseId_slot_idx" ON "PastPaper"("courseId", "slot");

-- AddForeignKey
ALTER TABLE "PastPaper" ADD CONSTRAINT "PastPaper_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
