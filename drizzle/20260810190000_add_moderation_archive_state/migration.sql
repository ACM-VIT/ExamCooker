ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "moderationArchivedAt" timestamp(3);
ALTER TABLE "PastPaper" ADD COLUMN IF NOT EXISTS "moderationArchivedAt" timestamp(3);

CREATE INDEX IF NOT EXISTS "Note_moderationArchivedAt_idx"
  ON "Note" ("moderationArchivedAt");
CREATE INDEX IF NOT EXISTS "PastPaper_moderationArchivedAt_idx"
  ON "PastPaper" ("moderationArchivedAt");
