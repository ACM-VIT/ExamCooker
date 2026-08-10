import type { Campus, ExamType, Semester } from "@/db/enums";

export const AI_MODERATION_MODEL = "gpt-5.6-luna";

export type ModerationResourceType = "note" | "pastPaper";
export type ModerationReviewStatus =
  | "approved"
  | "needs_changes"
  | "duplicate"
  | "failed";

export type ModerationReviewIssue = {
  field: string;
  message: string;
};

export type ModerationSuggestion = {
  title: string;
  courseId: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  examType: ExamType | null;
  slot: string | null;
  year: number | null;
  semester: Semester | null;
  campus: Campus | null;
  hasAnswerKey: boolean | null;
};

export type ModerationDuplicate = {
  id: string;
  title: string;
  reason: string;
  confidence: number;
};

export type AiModerationReview = {
  version: 2;
  model: typeof AI_MODERATION_MODEL;
  status: ModerationReviewStatus;
  documentKind: "past_paper" | "notes" | "other";
  confidence: number;
  summary: string;
  issues: ModerationReviewIssue[];
  suggestion: ModerationSuggestion;
  duplicate: ModerationDuplicate | null;
  corpusSize: number;
  resourceUpdatedAt: string;
  reviewedAt: string;
  autoApproved: boolean;
};

export function isCurrentModerationReview(
  review: AiModerationReview | null | undefined,
  resourceUpdatedAt: Date,
) {
  return (
    typeof review?.resourceUpdatedAt === "string" &&
    review.resourceUpdatedAt === resourceUpdatedAt.toISOString()
  );
}

export const clearedModerationReview = {
  aiReview: null,
  aiReviewedAt: null,
} as const;
