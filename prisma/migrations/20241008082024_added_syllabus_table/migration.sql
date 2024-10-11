-- AlterTable
ALTER TABLE "ViewHistory" ADD COLUMN     "syllabusId" STRING;

-- CreateTable
CREATE TABLE "Syllabus" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "fileUrl" STRING NOT NULL,

    CONSTRAINT "Syllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserBookmarkedSyllabus" (
    "A" STRING NOT NULL,
    "B" STRING NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserBookmarkedSyllabus_AB_unique" ON "_UserBookmarkedSyllabus"("A", "B");

-- CreateIndex
CREATE INDEX "_UserBookmarkedSyllabus_B_index" ON "_UserBookmarkedSyllabus"("B");

-- AddForeignKey
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "Syllabus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserBookmarkedSyllabus" ADD CONSTRAINT "_UserBookmarkedSyllabus_A_fkey" FOREIGN KEY ("A") REFERENCES "Syllabus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserBookmarkedSyllabus" ADD CONSTRAINT "_UserBookmarkedSyllabus_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
