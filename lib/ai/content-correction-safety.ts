import { z } from "zod";
import type { AiModerationReview } from "@/lib/ai/moderation-review-types";

const correctionFieldValues = [
  "title",
  "courseId",
  "examType",
  "slot",
  "year",
  "semester",
  "campus",
  "hasAnswerKey",
] as const;

const CorrectionFieldsSchema = z.array(z.enum(correctionFieldValues)).min(1);
export type CorrectionField = (typeof correctionFieldValues)[number];

function hasConcreteReplacement(
  field: CorrectionField,
  suggestion: AiModerationReview["suggestion"],
) {
  if (field === "title") return suggestion.title.trim().length >= 2;
  if (field === "courseId") return suggestion.courseId !== null;
  if (field === "examType") return suggestion.examType !== null;
  if (field === "year") return suggestion.year !== null;
  if (field === "semester") return suggestion.semester !== null;
  if (field === "campus") return suggestion.campus !== null;
  if (field === "hasAnswerKey") return suggestion.hasAnswerKey === false;
  return true;
}

export function applicableCorrectionFields(
  fields: Iterable<string>,
  suggestion: AiModerationReview["suggestion"],
) {
  const parsed = CorrectionFieldsSchema.safeParse([...fields]);
  if (!parsed.success) return [];
  return [...new Set(parsed.data)].filter((field) =>
    hasConcreteReplacement(field, suggestion),
  );
}

export function canApplyCorrectionSuggestion(
  fields: Iterable<string>,
  suggestion: AiModerationReview["suggestion"],
) {
  const requested = [...fields];
  const applicable = applicableCorrectionFields(requested, suggestion);
  return requested.length > 0 && applicable.length === new Set(requested).size;
}

export function requireApplicableCorrectionFields(
  fields: Iterable<string>,
  suggestion: AiModerationReview["suggestion"],
) {
  const requested = [...fields];
  if (!canApplyCorrectionSuggestion(requested, suggestion)) {
    throw new Error("The correction does not contain a complete, safe replacement.");
  }
  return new Set(CorrectionFieldsSchema.parse(requested));
}
