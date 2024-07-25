/*
  Warnings:

  - You are about to drop the column `forumId` on the `ViewHistory` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,pastPaperId]` on the table `ViewHistory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,noteId]` on the table `ViewHistory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,forumPostId]` on the table `ViewHistory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,subjectId]` on the table `ViewHistory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- DropForeignKey
ALTER TABLE "ViewHistory" DROP CONSTRAINT "ViewHistory_forumId_fkey";

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "thumbNailUrl" STRING;

-- AlterTable
ALTER TABLE "PastPaper" ADD COLUMN     "thumbNailUrl" STRING;

-- AlterTable
ALTER TABLE "ViewHistory" DROP COLUMN "forumId";
ALTER TABLE "ViewHistory" ADD COLUMN     "forumPostId" STRING;

-- CreateTable
CREATE TABLE "Vote" (
    "id" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "forumPostId" STRING NOT NULL,
    "type" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_forumPostId_key" ON "Vote"("userId", "forumPostId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewHistory_userId_pastPaperId_key" ON "ViewHistory"("userId", "pastPaperId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewHistory_userId_noteId_key" ON "ViewHistory"("userId", "noteId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewHistory_userId_forumPostId_key" ON "ViewHistory"("userId", "forumPostId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewHistory_userId_subjectId_key" ON "ViewHistory"("userId", "subjectId");

-- AddForeignKey
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_forumPostId_fkey" FOREIGN KEY ("forumPostId") REFERENCES "ForumPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_forumPostId_fkey" FOREIGN KEY ("forumPostId") REFERENCES "ForumPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
