-- CreateTable
CREATE TABLE "UpcomingExam" (
    "id" STRING NOT NULL,
    "courseId" STRING NOT NULL,
    "slots" STRING[],
    "examType" "ExamType",
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpcomingExam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpcomingExam_courseId_idx" ON "UpcomingExam"("courseId");

-- CreateIndex
CREATE INDEX "UpcomingExam_scheduledAt_idx" ON "UpcomingExam"("scheduledAt");

-- AddForeignKey
ALTER TABLE "UpcomingExam" ADD CONSTRAINT "UpcomingExam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
