/*
  Warnings:

  - You are about to drop the column `CourseCode` on the `Tag` table. All the data in the column will be lost.
  - You are about to drop the column `slot` on the `Tag` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `Tag` table. All the data in the column will be lost.
  - You are about to drop the `ViewHistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ViewHistory" DROP CONSTRAINT "ViewHistory_forumId_fkey";

-- DropForeignKey
ALTER TABLE "ViewHistory" DROP CONSTRAINT "ViewHistory_noteId_fkey";

-- DropForeignKey
ALTER TABLE "ViewHistory" DROP CONSTRAINT "ViewHistory_pastPaperId_fkey";

-- DropForeignKey
ALTER TABLE "ViewHistory" DROP CONSTRAINT "ViewHistory_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "ViewHistory" DROP CONSTRAINT "ViewHistory_userId_fkey";

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "CourseCode";
ALTER TABLE "Tag" DROP COLUMN "slot";
ALTER TABLE "Tag" DROP COLUMN "year";

-- DropTable
DROP TABLE "ViewHistory";
