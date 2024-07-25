/*
  Warnings:

  - You are about to drop the column `createdAt` on the `ViewHistory` table. All the data in the column will be lost.
  - You are about to drop the column `recent` on the `ViewHistory` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ViewHistory` table. All the data in the column will be lost.
  - Added the required column `forumId` to the `ViewHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `noteId` to the `ViewHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pastPaperId` to the `ViewHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subjectId` to the `ViewHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `viewedAt` to the `ViewHistory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ViewHistory_userId_key";

-- AlterTable
ALTER TABLE "ViewHistory" DROP COLUMN "createdAt";
ALTER TABLE "ViewHistory" DROP COLUMN "recent";
ALTER TABLE "ViewHistory" DROP COLUMN "updatedAt";
ALTER TABLE "ViewHistory" ADD COLUMN     "forumId" STRING NOT NULL;
ALTER TABLE "ViewHistory" ADD COLUMN     "noteId" STRING NOT NULL;
ALTER TABLE "ViewHistory" ADD COLUMN     "pastPaperId" STRING NOT NULL;
ALTER TABLE "ViewHistory" ADD COLUMN     "subjectId" STRING NOT NULL;
ALTER TABLE "ViewHistory" ADD COLUMN     "viewedAt" TIMESTAMP(3) NOT NULL;

-- AddForeignKey
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_pastPaperId_fkey" FOREIGN KEY ("pastPaperId") REFERENCES "PastPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
