import type { AiModerationReview } from "@/lib/ai/moderation-review-types";

export const correctionReportCategories = [
  "wrong_title",
  "wrong_course",
  "wrong_exam_details",
  "wrong_resource_type",
  "duplicate",
  "other",
] as const;

export type CorrectionReportCategory =
  (typeof correctionReportCategories)[number];

// The database enforces this list with ContentCorrectionReport_status_check.
export const correctionReportStatuses = [
  "pending",
  "auto_approved",
  "auto_denied",
  "needs_review",
  "approved",
  "denied",
] as const;

export type CorrectionReportStatus = (typeof correctionReportStatuses)[number];

export type CorrectionReportDecision = {
  model: string;
  decision: "approve" | "deny" | "stage";
  claimVerdict: "supported" | "unsupported" | "uncertain";
  confidence: number;
  summary: string;
  review: AiModerationReview;
  appliedFields: string[];
  proposedFields: string[];
  resourceUpdatedAt: string;
  decidedAt: string;
};
