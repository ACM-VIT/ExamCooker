/*
  Warnings:

  - A unique constraint covering the columns `[userId,syllabusId]` on the table `ViewHistory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ViewHistory_userId_syllabusId_key" ON "ViewHistory"("userId", "syllabusId");
