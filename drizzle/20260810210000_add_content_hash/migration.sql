ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "PastPaper" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;

CREATE INDEX IF NOT EXISTS "Note_courseId_contentHash_idx"
  ON "Note" ("courseId", "contentHash");
CREATE INDEX IF NOT EXISTS "PastPaper_courseId_contentHash_idx"
  ON "PastPaper" ("courseId", "contentHash");
