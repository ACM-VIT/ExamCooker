ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "aiReview" jsonb;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "aiReviewedAt" timestamp(3);
ALTER TABLE "PastPaper" ADD COLUMN IF NOT EXISTS "aiReview" jsonb;
ALTER TABLE "PastPaper" ADD COLUMN IF NOT EXISTS "aiReviewedAt" timestamp(3);
