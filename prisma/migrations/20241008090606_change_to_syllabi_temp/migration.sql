/*
  Warnings:

  - You are about to drop the `Syllabus` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ViewHistory" DROP CONSTRAINT "ViewHistory_syllabusId_fkey";

-- DropForeignKey
ALTER TABLE "_UserBookmarkedSyllabus" DROP CONSTRAINT "_UserBookmarkedSyllabus_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserBookmarkedSyllabus" DROP CONSTRAINT "_UserBookmarkedSyllabus_B_fkey";

-- DropTable
DROP TABLE "Syllabus";

-- CreateTable
CREATE TABLE "syllabi" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "fileUrl" STRING NOT NULL,

    CONSTRAINT "syllabi_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserBookmarkedSyllabus" ADD CONSTRAINT "_UserBookmarkedSyllabus_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserBookmarkedSyllabus" ADD CONSTRAINT "_UserBookmarkedSyllabus_B_fkey" FOREIGN KEY ("B") REFERENCES "syllabi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
