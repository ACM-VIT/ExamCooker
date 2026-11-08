-- Archiving always unpublishes a resource; keep the two states exclusive.
ALTER TABLE "Note" ADD CONSTRAINT "Note_archived_unpublished_check"
  CHECK (NOT ("isClear" AND "moderationArchivedAt" IS NOT NULL));
ALTER TABLE "PastPaper" ADD CONSTRAINT "PastPaper_archived_unpublished_check"
  CHECK (NOT ("isClear" AND "moderationArchivedAt" IS NOT NULL));

-- Correction report status was free text; only the lifecycle's states are valid.
ALTER TABLE "ContentCorrectionReport" ADD CONSTRAINT "ContentCorrectionReport_status_check"
  CHECK ("status" IN ('pending', 'auto_approved', 'auto_denied', 'needs_review', 'approved', 'denied'));
