"use server";

import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { and, count, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/app/auth";
import { contentCorrectionReport, course, db, note, pastPaper } from "@/db";
import {
  correctionReportCategories,
  type CorrectionReportDecision,
} from "@/lib/ai/content-correction-types";
import {
  applyCorrectionSuggestion,
  reviewContentCorrectionReport,
} from "@/lib/ai/content-correction-review";
import { canApplyCorrectionSuggestion } from "@/lib/ai/content-correction-safety";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import { checkSlidingWindowRateLimit } from "@/lib/redis-rate-limit";

const REPORT_RATE_LIMIT = 5;
const REPORT_RATE_WINDOW_MS = 60 * 60 * 1000;
const PENDING_REVIEW_RECLAIM_MS = 5 * 60 * 1000;

function reclaimableReportCondition(reportId: string, staleBefore: Date) {
  return and(
    eq(contentCorrectionReport.id, reportId),
    or(
      eq(contentCorrectionReport.status, "needs_review"),
      and(
        eq(contentCorrectionReport.status, "pending"),
        lte(contentCorrectionReport.updatedAt, staleBefore),
      ),
    ),
  );
}

const SubmitReportSchema = z.object({
  resourceId: z.string().min(1),
  resourceType: z.enum(["note", "pastPaper"]),
  category: z.enum(correctionReportCategories),
  description: z.string().trim().min(10).max(1200),
  suggestedValue: z.string().trim().max(500).optional(),
});

export type ModerationCorrectionReport = {
  id: string;
  resourceId: string;
  resourceType: "note" | "pastPaper";
  resourceTitle: string;
  resourceCourseCode: string | null;
  category: string;
  description: string;
  suggestedValue: string | null;
  status: string;
  aiDecision: CorrectionReportDecision | null;
  canApply: boolean;
  canConvertType: boolean;
  canRecheck: boolean;
  canUnpublishDuplicate: boolean;
  isStale: boolean;
  createdAt: Date;
};

export type CorrectionReportResolution =
  | "apply"
  | "convert_type"
  | "dismiss"
  | "unpublish_duplicate";

function scheduleContentCorrectionReview(reportId: string) {
  after(async () => {
    await reviewContentCorrectionReport(reportId);
    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
    await invalidatePastPapersSurfaceCache();
  });
}

export async function submitContentCorrectionReport(input: z.input<typeof SubmitReportSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in to report a correction.");
  const data = SubmitReportSchema.parse(input);

  const windowStartedAt = new Date(Date.now() - REPORT_RATE_WINDOW_MS);
  const [redisLimit, recentReports] = await Promise.all([
    checkSlidingWindowRateLimit({
      identifier: session.user.id,
      limit: REPORT_RATE_LIMIT,
      prefix: "content-correction-report",
      windowMs: REPORT_RATE_WINDOW_MS,
    }),
    db
      .select({ total: count() })
      .from(contentCorrectionReport)
      .where(
        and(
          eq(contentCorrectionReport.reporterId, session.user.id),
          gte(contentCorrectionReport.createdAt, windowStartedAt),
        ),
      ),
  ]);
  if (!redisLimit.success || (recentReports[0]?.total ?? 0) >= REPORT_RATE_LIMIT) {
    throw new Error("You have sent several reports recently. Please try again later.");
  }

  const resourceExists =
    data.resourceType === "note"
      ? await db
          .select({ id: note.id })
          .from(note)
          .where(and(eq(note.id, data.resourceId), eq(note.isClear, true)))
          .limit(1)
      : await db
          .select({ id: pastPaper.id })
          .from(pastPaper)
          .where(
            and(
              eq(pastPaper.id, data.resourceId),
              eq(pastPaper.isClear, true),
            ),
          )
          .limit(1);
  if (!resourceExists[0]) {
    throw new Error("This published resource is no longer available.");
  }

  const [existing] = await db
    .select({ id: contentCorrectionReport.id })
    .from(contentCorrectionReport)
    .where(
      and(
        eq(contentCorrectionReport.reporterId, session.user.id),
        data.resourceType === "note"
          ? eq(contentCorrectionReport.noteId, data.resourceId)
          : eq(contentCorrectionReport.pastPaperId, data.resourceId),
        inArray(contentCorrectionReport.status, ["pending", "needs_review"]),
      ),
    )
    .limit(1);
  if (existing) {
    throw new Error("You already have an open report for this resource.");
  }

  const [created] = await db
    .insert(contentCorrectionReport)
    .values({
      resourceType: data.resourceType,
      noteId: data.resourceType === "note" ? data.resourceId : null,
      pastPaperId: data.resourceType === "pastPaper" ? data.resourceId : null,
      reporterId: session.user.id,
      category: data.category,
      description: data.description,
      suggestedValue: data.suggestedValue || null,
    })
    .returning({ id: contentCorrectionReport.id });
  if (!created) throw new Error("Could not create the report.");

  scheduleContentCorrectionReview(created.id);

  return { status: "submitted" as const, id: created.id };
}

export async function fetchModerationCorrectionReports(): Promise<ModerationCorrectionReport[]> {
  const session = await auth();
  if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");
  const reports = await db
    .select()
    .from(contentCorrectionReport)
    .where(inArray(contentCorrectionReport.status, ["pending", "needs_review"]))
    .orderBy(desc(contentCorrectionReport.createdAt));
  const noteIds = reports.flatMap((report) => (report.noteId ? [report.noteId] : []));
  const paperIds = reports.flatMap((report) =>
    report.pastPaperId ? [report.pastPaperId] : [],
  );
  const [noteResources, paperResources, linkedAnswerKeys] = await Promise.all([
    noteIds.length > 0
      ? db
          .select({
            id: note.id,
            title: note.title,
            courseCode: course.code,
            updatedAt: note.updatedAt,
          })
          .from(note)
          .leftJoin(course, eq(note.courseId, course.id))
          .where(inArray(note.id, noteIds))
      : Promise.resolve([]),
    paperIds.length > 0
      ? db
          .select({
            id: pastPaper.id,
            title: pastPaper.title,
            courseCode: course.code,
            hasAnswerKey: pastPaper.hasAnswerKey,
            updatedAt: pastPaper.updatedAt,
          })
          .from(pastPaper)
          .leftJoin(course, eq(pastPaper.courseId, course.id))
          .where(inArray(pastPaper.id, paperIds))
      : Promise.resolve([]),
    paperIds.length > 0
      ? db
          .select({
            questionPaperId: pastPaper.questionPaperId,
            courseId: pastPaper.courseId,
          })
          .from(pastPaper)
          .where(
            and(
              inArray(pastPaper.questionPaperId, paperIds),
              isNull(pastPaper.moderationArchivedAt),
            ),
          )
      : Promise.resolve([]),
  ]);
  const noteResourcesById = new Map(noteResources.map((resource) => [resource.id, resource]));
  const paperResourcesById = new Map(
    paperResources.map((resource) => [resource.id, resource]),
  );
  const questionPaperIdsWithAnswerKeys = new Set(
    linkedAnswerKeys.flatMap((paper) =>
      paper.questionPaperId ? [paper.questionPaperId] : [],
    ),
  );
  const linkedAnswerKeyCourseByQuestionPaperId = new Map(
    linkedAnswerKeys.flatMap((paper) =>
      paper.questionPaperId
        ? [[paper.questionPaperId, paper.courseId] as const]
        : [],
    ),
  );

  return reports.map((report) => {
    const resourceType = report.resourceType as "note" | "pastPaper";
    const resourceId = resourceType === "note" ? report.noteId! : report.pastPaperId!;
    const resource =
      resourceType === "note"
        ? noteResourcesById.get(resourceId)
        : paperResourcesById.get(resourceId);
    const resourceUpdatedAt = resource?.updatedAt.toISOString() ?? null;
    const reviewedUpdatedAt = report.aiDecision?.resourceUpdatedAt ?? null;
    const isReclaimablePending =
      report.status === "pending" &&
      report.updatedAt.getTime() <= Date.now() - PENDING_REVIEW_RECLAIM_MS;
    const isStale =
      report.status === "needs_review" &&
      (!resourceUpdatedAt || !reviewedUpdatedAt || resourceUpdatedAt !== reviewedUpdatedAt);
    const isOppositeDocumentKind =
      (resourceType === "note" &&
        report.aiDecision?.review.documentKind === "past_paper") ||
      (resourceType === "pastPaper" &&
        report.aiDecision?.review.documentKind === "notes");
    const changesLinkedAnswerKeyCourse =
      resourceType === "pastPaper" &&
      report.aiDecision?.proposedFields.includes("courseId") === true &&
      ((paperResourcesById.get(resourceId)?.hasAnswerKey === true &&
        report.aiDecision.review.suggestion.hasAnswerKey !== false) ||
        (linkedAnswerKeyCourseByQuestionPaperId.has(resourceId) &&
          linkedAnswerKeyCourseByQuestionPaperId.get(resourceId) !==
            report.aiDecision.review.suggestion.courseId));
    const wouldCreateUnlinkedAnswerKey =
      resourceType === "note" &&
      report.aiDecision?.review.suggestion.hasAnswerKey === true;
    const wouldBreakAnswerKeyLink =
      resourceType === "pastPaper" &&
      questionPaperIdsWithAnswerKeys.has(resourceId);
    return {
      id: report.id,
      resourceId,
      resourceType,
      resourceTitle: resource?.title ?? "Deleted resource",
      resourceCourseCode: resource?.courseCode ?? null,
      category: report.category,
      description: report.description,
      suggestedValue: report.suggestedValue,
      status: report.status,
      aiDecision: report.aiDecision ?? null,
      canApply: report.aiDecision
        ? !isStale &&
          !changesLinkedAnswerKeyCourse &&
          canApplyCorrectionSuggestion(
            report.aiDecision.proposedFields,
            report.aiDecision.review.suggestion,
          )
        : false,
      canConvertType:
        !isStale &&
        !wouldCreateUnlinkedAnswerKey &&
        !wouldBreakAnswerKeyLink &&
        report.category === "wrong_resource_type" &&
        isOppositeDocumentKind,
      canRecheck: report.status === "needs_review" || isReclaimablePending,
      canUnpublishDuplicate:
        !isStale &&
        !questionPaperIdsWithAnswerKeys.has(resourceId) &&
        report.category === "duplicate" &&
        report.aiDecision?.review.status === "duplicate",
      isStale,
      createdAt: report.createdAt,
    };
  });
}

export async function recheckContentCorrectionReport(reportId: string) {
  const session = await auth();
  if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

  const staleBefore = new Date(Date.now() - PENDING_REVIEW_RECLAIM_MS);
  const [report] = await db
    .update(contentCorrectionReport)
    .set({ status: "pending", aiDecision: null, resolvedAt: null, resolvedById: null })
    .where(reclaimableReportCondition(reportId, staleBefore))
    .returning({ id: contentCorrectionReport.id });
  if (!report) throw new Error("This report is no longer awaiting review.");

  scheduleContentCorrectionReview(report.id);
  revalidatePath("/mod");
  return { status: "pending" as const };
}

export async function resolveContentCorrectionReport(
  reportId: string,
  resolution: CorrectionReportResolution,
) {
  const session = await auth();
  if (session?.user?.role !== "MODERATOR" || !session.user.id) {
    throw new Error("Access denied");
  }

  const staleBefore = new Date(Date.now() - PENDING_REVIEW_RECLAIM_MS);
  const [report] = await db
    .select()
    .from(contentCorrectionReport)
    .where(reclaimableReportCondition(reportId, staleBefore))
    .limit(1);
  if (!report) throw new Error("This report is no longer awaiting review.");

  const proposedFields = report.aiDecision?.proposedFields ?? [];
  if (
    resolution === "apply" &&
    (!report.aiDecision ||
      !canApplyCorrectionSuggestion(
        proposedFields,
        report.aiDecision.review.suggestion,
      ))
  ) {
    throw new Error(
      "This report has no safe automatic correction. Fix the resource first or dismiss the report.",
    );
  }
  if (resolution === "convert_type" && report.category !== "wrong_resource_type") {
    throw new Error("Only a wrong-type report can convert a resource.");
  }
  if (
    resolution === "unpublish_duplicate" &&
    (report.category !== "duplicate" ||
      report.aiDecision?.review.status !== "duplicate")
  ) {
    throw new Error("Only an agent-verified duplicate can be unpublished.");
  }
  if (resolution !== "dismiss" && !report.aiDecision?.resourceUpdatedAt) {
    throw new Error("Recheck this report before applying it.");
  }

  const expectedUpdatedAt = report.aiDecision?.resourceUpdatedAt;
  const moderationArchivedAt = new Date();
  let appliedFields: string[] = [];
  let convertedResource: { id: string; type: "note" | "pastPaper" } | null = null;
  await db.transaction(async (transaction) => {
    if (resolution === "apply" && report.aiDecision) {
      const resourceType = report.resourceType as "note" | "pastPaper";
      const resourceId = resourceType === "note" ? report.noteId : report.pastPaperId;
      if (!resourceId) throw new Error("The reported resource no longer exists.");
      appliedFields = await applyCorrectionSuggestion(
        {
          fields: proposedFields,
          resourceId,
          resourceType,
          review: report.aiDecision.review,
          expectedUpdatedAt,
        },
        transaction,
      );
      if (appliedFields.length === 0) {
        throw new Error(
          "The stored suggestion no longer contains a safe correction.",
        );
      }
    }

    if (resolution === "unpublish_duplicate" && report.aiDecision) {
      const resourceType = report.resourceType as "note" | "pastPaper";
      const resourceId = resourceType === "note" ? report.noteId : report.pastPaperId;
      if (!resourceId || !expectedUpdatedAt) {
        throw new Error("The reported resource no longer exists.");
      }
      if (resourceType === "pastPaper") {
        const [linkedAnswerKey] = await transaction
          .select({ id: pastPaper.id })
          .from(pastPaper)
          .where(
            and(
              eq(pastPaper.questionPaperId, resourceId),
              isNull(pastPaper.moderationArchivedAt),
            ),
          )
          .limit(1);
        if (linkedAnswerKey) {
          throw new Error(
            "Move or unpublish the linked answer key before unpublishing this question paper.",
          );
        }
      }

      const [unpublished] =
        resourceType === "note"
          ? await transaction
              .update(note)
              .set({
                isClear: false,
                aiReview: null,
                aiReviewedAt: null,
                moderationArchivedAt,
              })
              .where(
                and(
                  eq(note.id, resourceId),
                  eq(note.isClear, true),
                  eq(note.updatedAt, new Date(expectedUpdatedAt)),
                ),
              )
              .returning({ id: note.id })
          : await transaction
              .update(pastPaper)
              .set({
                isClear: false,
                aiReview: null,
                aiReviewedAt: null,
                moderationArchivedAt,
              })
              .where(
                and(
                  eq(pastPaper.id, resourceId),
                  eq(pastPaper.isClear, true),
                  eq(pastPaper.updatedAt, new Date(expectedUpdatedAt)),
                ),
              )
              .returning({ id: pastPaper.id });
      if (!unpublished) {
        throw new Error("The resource changed after this report was reviewed. Recheck it first.");
      }
      appliedFields = ["visibility"];
    }

    if (resolution === "convert_type" && report.aiDecision) {
      const resourceType = report.resourceType as "note" | "pastPaper";
      const resourceId = resourceType === "note" ? report.noteId : report.pastPaperId;
      if (!resourceId || !expectedUpdatedAt) {
        throw new Error("The reported resource no longer exists.");
      }
      const suggestion = report.aiDecision.review.suggestion;

      if (resourceType === "note") {
        if (report.aiDecision.review.documentKind !== "past_paper") {
          throw new Error("The agent did not verify this note as a past paper.");
        }
        if (suggestion.hasAnswerKey === true) {
          throw new Error(
            "Move this manually so the answer key can be linked to its question paper.",
          );
        }
        const [source] = await transaction
          .update(note)
          .set({
            isClear: false,
            aiReview: null,
            aiReviewedAt: null,
            moderationArchivedAt,
          })
          .where(
            and(
              eq(note.id, resourceId),
              eq(note.isClear, true),
              eq(note.updatedAt, new Date(expectedUpdatedAt)),
            ),
          )
          .returning({
            authorId: note.authorId,
            courseId: note.courseId,
            fileUrl: note.fileUrl,
            thumbNailUrl: note.thumbNailUrl,
            title: note.title,
          });
        if (!source) {
          throw new Error("The resource changed after this report was reviewed. Recheck it first.");
        }
        const [created] = await transaction
          .insert(pastPaper)
          .values({
            authorId: source.authorId,
            courseId: suggestion.courseId ?? source.courseId,
            fileUrl: source.fileUrl,
            thumbNailUrl: source.thumbNailUrl,
            title: suggestion.title.trim() || source.title,
            isClear: true,
            ...(suggestion.examType ? { examType: suggestion.examType } : {}),
            ...(suggestion.slot ? { slot: suggestion.slot } : {}),
            ...(suggestion.year ? { year: suggestion.year } : {}),
            semester: suggestion.semester ?? "UNKNOWN",
            campus: suggestion.campus ?? "VELLORE",
            hasAnswerKey: suggestion.hasAnswerKey ?? false,
          })
          .returning({ id: pastPaper.id });
        if (!created) throw new Error("Could not create the converted past paper.");
        convertedResource = { id: created.id, type: "pastPaper" };
      } else {
        if (report.aiDecision.review.documentKind !== "notes") {
          throw new Error("The agent did not verify this past paper as notes.");
        }
        const [linkedAnswerKey] = await transaction
          .select({ id: pastPaper.id })
          .from(pastPaper)
          .where(eq(pastPaper.questionPaperId, resourceId))
          .limit(1);
        if (linkedAnswerKey) {
          throw new Error(
            "Unlink the published answer key before moving this question paper to notes.",
          );
        }
        const [source] = await transaction
          .update(pastPaper)
          .set({
            isClear: false,
            aiReview: null,
            aiReviewedAt: null,
            moderationArchivedAt,
            questionPaperId: null,
          })
          .where(
            and(
              eq(pastPaper.id, resourceId),
              eq(pastPaper.isClear, true),
              eq(pastPaper.updatedAt, new Date(expectedUpdatedAt)),
            ),
          )
          .returning({
            authorId: pastPaper.authorId,
            courseId: pastPaper.courseId,
            fileUrl: pastPaper.fileUrl,
            thumbNailUrl: pastPaper.thumbNailUrl,
            title: pastPaper.title,
          });
        if (!source) {
          throw new Error("The resource changed after this report was reviewed. Recheck it first.");
        }
        const [created] = await transaction
          .insert(note)
          .values({
            authorId: source.authorId,
            courseId: suggestion.courseId ?? source.courseId,
            fileUrl: source.fileUrl,
            thumbNailUrl: source.thumbNailUrl,
            title: suggestion.title.trim() || source.title,
            isClear: true,
          })
          .returning({ id: note.id });
        if (!created) throw new Error("Could not create the converted note.");
        convertedResource = { id: created.id, type: "note" };
      }
      appliedFields = ["resourceType"];
    }

    const [resolvedReport] = await transaction
      .update(contentCorrectionReport)
      .set({
        status: resolution === "dismiss" ? "denied" : "approved",
        ...(report.aiDecision
          ? {
              aiDecision: {
                ...report.aiDecision,
                appliedFields,
              },
            }
          : {}),
        resolvedAt: new Date(),
        resolvedById: session.user.id,
      })
      .where(reclaimableReportCondition(reportId, staleBefore))
      .returning({ id: contentCorrectionReport.id });
    if (!resolvedReport) {
      throw new Error("This report was resolved by another moderator.");
    }
  });
  revalidatePath("/mod");
  revalidateTag("notes", "minutes");
  revalidateTag("past_papers", "minutes");
  await invalidatePastPapersSurfaceCache();
  return { appliedFields, convertedResource };
}
