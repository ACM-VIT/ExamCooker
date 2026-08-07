import { z } from "zod";
import { campusValues, examTypeValues, semesterValues } from "@/db/enums";

export const StudyPreferenceModeSchema = z.enum([
  "videos",
  "past_papers",
  "notes",
  "solved_examples",
  "quick_summaries",
  "mixed",
]);

export const StudyPlanPrioritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);

export const StudyPlanEvidenceSchema = z.object({
  type: z.enum(["syllabus", "past_paper", "slot_report", "web", "resource"]),
  label: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
});

export const StudyPlanTaskSchema = z.object({
  kind: z.enum(["read", "watch", "practice", "revise", "skim"]),
  title: z.string().min(1),
  url: z.string().url().optional(),
  source: z.string().optional(),
  estimatedMinutes: z.number().int().min(1).max(240),
  skipIfShortOnTime: z.boolean().optional(),
});

export const StudyPlanSectionSchema = z.object({
  topicId: z.string().optional(),
  topicTitle: z.string().min(1),
  priority: StudyPlanPrioritySchema,
  estimatedMinutes: z.number().int().min(1).max(600),
  reason: z.string().min(1),
  evidence: z.array(StudyPlanEvidenceSchema),
  tasks: z.array(StudyPlanTaskSchema),
});

export const StudyPlanSchema = z.object({
  title: z.string().min(1),
  context: z.object({
    courseCode: z.string().min(1),
    courseTitle: z.string().min(1),
    examType: z.enum(examTypeValues).nullable(),
    slot: z.string().nullable().optional(),
    syllabusName: z.string().nullable().optional(),
  }),
  evidenceSummary: z.object({
    syllabusTopicsUsed: z.number().int().min(0),
    pastPapersUsed: z.number().int().min(0),
    earlierSlotSignalsUsed: z.number().int().min(0),
    webResourcesUsed: z.number().int().min(0),
  }),
  totalEstimatedMinutes: z.number().int().min(0),
  sections: z.array(StudyPlanSectionSchema),
  warnings: z.array(z.string()),
});

export const StudyBrainPlanRequestSchema = z.object({
  courseCode: z.string().min(1),
  examType: z.enum(examTypeValues).nullable(),
  semester: z.enum(semesterValues).default("UNKNOWN"),
  campus: z.enum(campusValues).default("VELLORE"),
  slot: z.string().trim().max(20).nullable().optional(),
  syllabusId: z.string().nullable().optional(),
  selectedTopics: z.array(
    z.object({
      topicId: z.string().nullable().optional(),
      title: z.string().min(1),
      rawText: z.string().optional(),
    }),
  ),
  preferences: z.array(StudyPreferenceModeSchema).min(1),
});

export type StudyPreferenceMode = z.infer<typeof StudyPreferenceModeSchema>;
export type StudyPlan = z.infer<typeof StudyPlanSchema>;
export type StudyPlanSection = z.infer<typeof StudyPlanSectionSchema>;
export type StudyBrainPlanRequest = z.infer<typeof StudyBrainPlanRequestSchema>;
