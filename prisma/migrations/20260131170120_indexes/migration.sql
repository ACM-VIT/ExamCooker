-- CreateIndex
CREATE INDEX "ForumPost_createdAt_idx" ON "ForumPost"("createdAt");

-- CreateIndex
CREATE INDEX "Note_isClear_createdAt_idx" ON "Note"("isClear", "createdAt");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");

-- CreateIndex
CREATE INDEX "PastPaper_isClear_createdAt_idx" ON "PastPaper"("isClear", "createdAt");

-- CreateIndex
CREATE INDEX "PastPaper_createdAt_idx" ON "PastPaper"("createdAt");
