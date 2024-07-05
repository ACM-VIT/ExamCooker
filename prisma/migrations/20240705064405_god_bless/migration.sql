/*
  Warnings:

  - You are about to drop the column `rating` on the `ForumPost` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ForumPost" DROP COLUMN "rating";
ALTER TABLE "ForumPost" ADD COLUMN     "description" STRING NOT NULL DEFAULT '';
ALTER TABLE "ForumPost" ADD COLUMN     "downvoteCount" INT4 NOT NULL DEFAULT 0;
ALTER TABLE "ForumPost" ADD COLUMN     "upvoteCount" INT4 NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "CourseCode" STRING;
ALTER TABLE "Tag" ADD COLUMN     "slot" STRING;
ALTER TABLE "Tag" ADD COLUMN     "year" INT4;

-- CreateTable
CREATE TABLE "_UserBookmarkedForumPosts" (
    "A" STRING NOT NULL,
    "B" STRING NOT NULL
);

-- CreateTable
CREATE TABLE "_UserBookmarkedResources" (
    "A" STRING NOT NULL,
    "B" STRING NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserBookmarkedForumPosts_AB_unique" ON "_UserBookmarkedForumPosts"("A", "B");

-- CreateIndex
CREATE INDEX "_UserBookmarkedForumPosts_B_index" ON "_UserBookmarkedForumPosts"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_UserBookmarkedResources_AB_unique" ON "_UserBookmarkedResources"("A", "B");

-- CreateIndex
CREATE INDEX "_UserBookmarkedResources_B_index" ON "_UserBookmarkedResources"("B");

-- AddForeignKey
ALTER TABLE "_UserBookmarkedForumPosts" ADD CONSTRAINT "_UserBookmarkedForumPosts_A_fkey" FOREIGN KEY ("A") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserBookmarkedForumPosts" ADD CONSTRAINT "_UserBookmarkedForumPosts_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserBookmarkedResources" ADD CONSTRAINT "_UserBookmarkedResources_A_fkey" FOREIGN KEY ("A") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserBookmarkedResources" ADD CONSTRAINT "_UserBookmarkedResources_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
