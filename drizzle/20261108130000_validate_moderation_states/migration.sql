-- Checks existing rows against the constraints added NOT VALID in
-- 20261108120000_guard_moderation_states. Every writer already keeps these
-- rules, so this should find nothing. If it fails, these list the rows to fix:
--   SELECT "id" FROM "Note" WHERE "isClear" AND "moderationArchivedAt" IS NOT NULL;
--   SELECT "id" FROM "PastPaper" WHERE "isClear" AND "moderationArchivedAt" IS NOT NULL;
--   SELECT "id", "status" FROM "ContentCorrectionReport"
--     WHERE "status" NOT IN ('pending', 'auto_approved', 'auto_denied', 'needs_review', 'approved', 'denied');
ALTER TABLE "Note" VALIDATE CONSTRAINT "Note_archived_unpublished_check";
ALTER TABLE "PastPaper" VALIDATE CONSTRAINT "PastPaper_archived_unpublished_check";
ALTER TABLE "ContentCorrectionReport" VALIDATE CONSTRAINT "ContentCorrectionReport_status_check";
