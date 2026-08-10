"use server";

import { and, count, desc, eq, getTableColumns, isNull, lt, ne, or } from "drizzle-orm";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import { generatePastPaperTitleFromPdf } from "@/lib/ai/past-paper-title";
import { reviewUploadedResource } from "@/lib/ai/moderation-review";
import {
    clearedModerationReview,
    isCurrentModerationReview,
    type AiModerationReview,
} from "@/lib/ai/moderation-review-types";
import { fetchModerationCorrectionReports } from "@/app/actions/content-correction-reports";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import { course, db, note, pastPaper, user } from "@/db";

export async function fetchUnclearedItems() {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const noteColumns = getTableColumns(note);
    const pastPaperColumns = getTableColumns(pastPaper);

    const [notes, pastPapers, totalRows] = await Promise.all([
        db
            .select({
                ...noteColumns,
                courseCode: course.code,
                courseTitle: course.title,
            })
            .from(note)
            .leftJoin(course, eq(note.courseId, course.id))
            .where(and(eq(note.isClear, false), isNull(note.moderationArchivedAt)))
            .orderBy(desc(note.createdAt)),
        db
            .select({
                ...pastPaperColumns,
                courseCode: course.code,
                courseTitle: course.title,
            })
            .from(pastPaper)
            .leftJoin(course, eq(pastPaper.courseId, course.id))
            .where(
                and(
                    eq(pastPaper.isClear, false),
                    isNull(pastPaper.moderationArchivedAt),
                ),
            )
            .orderBy(desc(pastPaper.createdAt)),
        db.select({ total: count() }).from(user),
    ]);

    const totalUsers = totalRows[0]?.total ?? 0;

    return {
        notes: notes.map((note) => ({
            ...note,
            fileUrl: normalizeGcsUrl(note.fileUrl) ?? note.fileUrl,
            thumbNailUrl: normalizeGcsUrl(note.thumbNailUrl) ?? note.thumbNailUrl,
            course:
                note.courseCode && note.courseTitle
                    ? { code: note.courseCode, title: note.courseTitle }
                    : null,
        })),
        pastPapers: pastPapers.map((paper) => ({
            ...paper,
            fileUrl: normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl,
            thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
            course:
                paper.courseCode && paper.courseTitle
                    ? {
                        code: paper.courseCode,
                        title: paper.courseTitle,
                    }
                    : null,
        })),
        totalUsers,
    };
}

export async function fetchModerationWorkbenchSnapshot() {
    const [queue, correctionReports] = await Promise.all([
        fetchUnclearedItems(),
        fetchModerationCorrectionReports(),
    ]);
    return { ...queue, correctionReports };
}

export async function approveItem(
    id: string,
    type: "note" | "pastPaper",
    options?: { allowDuplicate?: boolean },
) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const allowDuplicate = options?.allowDuplicate ?? false;

    if (type === "note") {
        if (!allowDuplicate) {
            const [pendingNote] = await db
                .select({
                    fileUrl: note.fileUrl,
                    contentHash: note.contentHash,
                    aiReview: note.aiReview,
                    createdAt: note.createdAt,
                    updatedAt: note.updatedAt,
                })
                .from(note)
                .where(
                    and(
                        eq(note.id, id),
                        eq(note.isClear, false),
                        isNull(note.moderationArchivedAt),
                    ),
                )
                .limit(1);
            if (!pendingNote) throw new Error("Note not found");
            if (
                isCurrentModerationReview(pendingNote.aiReview, pendingNote.updatedAt) &&
                pendingNote.aiReview?.status === "duplicate" &&
                pendingNote.aiReview.duplicate
            ) {
                return {
                    status: "duplicate" as const,
                    duplicateId: pendingNote.aiReview.duplicate.id,
                    duplicateTitle: pendingNote.aiReview.duplicate.title,
                };
            }
            const [fileDuplicate] = await db
                .select({ id: note.id, title: note.title })
                .from(note)
                .where(
                    and(
                        ne(note.id, id),
                        or(
                            eq(note.fileUrl, pendingNote.fileUrl),
                            pendingNote.contentHash
                                ? eq(note.contentHash, pendingNote.contentHash)
                                : undefined,
                        ),
                        or(
                            eq(note.isClear, true),
                            lt(note.createdAt, pendingNote.createdAt),
                            and(
                                eq(note.createdAt, pendingNote.createdAt),
                                lt(note.id, id),
                            ),
                        ),
                        isNull(note.moderationArchivedAt),
                    ),
                )
                .limit(1);
            if (fileDuplicate) {
                return {
                    status: "duplicate" as const,
                    duplicateId: fileDuplicate.id,
                    duplicateTitle: fileDuplicate.title,
                };
            }
        }
        const [approved] = await db
            .update(note)
            .set({ isClear: true })
            .where(
                and(
                    eq(note.id, id),
                    eq(note.isClear, false),
                    isNull(note.moderationArchivedAt),
                ),
            )
            .returning({ id: note.id });
        if (!approved) throw new Error("This note is no longer awaiting review.");
    } else {
        const paperRows = await db
            .select({
                fileUrl: pastPaper.fileUrl,
                contentHash: pastPaper.contentHash,
                aiReview: pastPaper.aiReview,
                createdAt: pastPaper.createdAt,
                updatedAt: pastPaper.updatedAt,
            })
            .from(pastPaper)
            .where(
                and(
                    eq(pastPaper.id, id),
                    eq(pastPaper.isClear, false),
                    isNull(pastPaper.moderationArchivedAt),
                ),
            )
            .limit(1);

        const paper = paperRows[0];
        if (!paper) throw new Error("Past paper not found");

        if (!allowDuplicate) {
            if (
                isCurrentModerationReview(paper.aiReview, paper.updatedAt) &&
                paper.aiReview?.status === "duplicate" &&
                paper.aiReview.duplicate
            ) {
                return {
                    status: "duplicate" as const,
                    duplicateId: paper.aiReview.duplicate.id,
                    duplicateTitle: paper.aiReview.duplicate.title,
                };
            }
            const fileDuplicateRows = await db
                .select({
                    id: pastPaper.id,
                    title: pastPaper.title,
                })
                .from(pastPaper)
                .where(
                    and(
                        ne(pastPaper.id, id),
                        or(
                            eq(pastPaper.fileUrl, paper.fileUrl),
                            paper.contentHash
                                ? eq(pastPaper.contentHash, paper.contentHash)
                                : undefined,
                        ),
                        or(
                            eq(pastPaper.isClear, true),
                            lt(pastPaper.createdAt, paper.createdAt),
                            and(
                                eq(pastPaper.createdAt, paper.createdAt),
                                lt(pastPaper.id, id),
                            ),
                        ),
                        isNull(pastPaper.moderationArchivedAt),
                    ),
                )
                .limit(1);

            const fileDuplicate = fileDuplicateRows[0];
            if (fileDuplicate) {
                return {
                    status: "duplicate" as const,
                    duplicateId: fileDuplicate.id,
                    duplicateTitle: fileDuplicate.title,
                };
            }

        }

        const [approved] = await db
            .update(pastPaper)
            .set({ isClear: true })
            .where(
                and(
                    eq(pastPaper.id, id),
                    eq(pastPaper.isClear, false),
                    isNull(pastPaper.moderationArchivedAt),
                ),
            )
            .returning({ id: pastPaper.id });
        if (!approved) throw new Error("This paper is no longer awaiting review.");
    }

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
    await invalidatePastPapersSurfaceCache();

    return { status: "approved" as const };
}

export async function renameItem(id: string, type: "note" | "pastPaper", title: string) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    if (type === "note") {
        await db
            .update(note)
            .set({ title, ...clearedModerationReview })
            .where(eq(note.id, id));
    }
    if (type === "pastPaper") {
        await db
            .update(pastPaper)
            .set({ title, ...clearedModerationReview })
            .where(eq(pastPaper.id, id));
    }

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
    if (type === "pastPaper") {
        revalidatePath(`/past_papers/${id}`);
        revalidateTag(`past_paper:${id}`, "minutes");
    }
    await invalidatePastPapersSurfaceCache();
}

export async function deleteItem(id: string, type: "note" | "pastPaper") {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    if (type === "note") await db.delete(note).where(eq(note.id, id));
    if (type === "pastPaper") await db.delete(pastPaper).where(eq(pastPaper.id, id));

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
    await invalidatePastPapersSurfaceCache();
}

export async function generatePastPaperTitle(id: string) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const rows = await db
        .select({
            title: pastPaper.title,
            fileUrl: pastPaper.fileUrl,
        })
        .from(pastPaper)
        .where(eq(pastPaper.id, id))
        .limit(1);

    const paper = rows[0];
    if (!paper) throw new Error("Past paper not found");

    const fileUrl = normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl;
    const aiTitle = await generatePastPaperTitleFromPdf({ fileUrl, fallbackTitle: paper.title });

    if (aiTitle && aiTitle !== paper.title) {
        await db
            .update(pastPaper)
            .set({ title: aiTitle, ...clearedModerationReview })
            .where(eq(pastPaper.id, id));
    }

    revalidatePath("/mod");
    revalidateTag("past_papers", "minutes");
    await invalidatePastPapersSurfaceCache();

    return { title: aiTitle };
}

function assertStoredReview(
    review: AiModerationReview | null,
    resourceUpdatedAt: Date,
) {
    if (!review || review.status === "failed") {
        throw new Error("Run the AI review before applying suggestions.");
    }
    if (!isCurrentModerationReview(review, resourceUpdatedAt)) {
        throw new Error("This AI review is stale. Run the review again before applying it.");
    }
    return review;
}

async function readModerationSuggestion(
    id: string,
    type: "note" | "pastPaper",
): Promise<AiModerationReview["suggestion"]> {
    if (type === "note") {
        const [row] = await db
            .select({
                title: note.title,
                courseId: note.courseId,
                courseCode: course.code,
                courseTitle: course.title,
            })
            .from(note)
            .leftJoin(course, eq(note.courseId, course.id))
            .where(eq(note.id, id))
            .limit(1);
        if (!row) throw new Error("Note not found");
        return {
            ...row,
            title: row.title.replace(/\.pdf$/i, "").trim(),
            examType: null,
            slot: null,
            year: null,
            semester: null,
            campus: null,
            hasAnswerKey: null,
        };
    }

    const [row] = await db
        .select({
            title: pastPaper.title,
            courseId: pastPaper.courseId,
            courseCode: course.code,
            courseTitle: course.title,
            examType: pastPaper.examType,
            slot: pastPaper.slot,
            year: pastPaper.year,
            semester: pastPaper.semester,
            campus: pastPaper.campus,
            hasAnswerKey: pastPaper.hasAnswerKey,
        })
        .from(pastPaper)
        .leftJoin(course, eq(pastPaper.courseId, course.id))
        .where(eq(pastPaper.id, id))
        .limit(1);
    if (!row) throw new Error("Past paper not found");
    return { ...row, title: row.title.replace(/\.pdf$/i, "").trim() };
}

export async function runAiModerationReview(
    id: string,
    type: "note" | "pastPaper",
) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const review = await reviewUploadedResource({ id, type, autoApprove: true });
    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
    await invalidatePastPapersSurfaceCache();
    return review;
}

export async function convertModerationResourceType(
    id: string,
    type: "note" | "pastPaper",
) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const targetType = type === "note" ? "pastPaper" : "note";
    await db.transaction(async (transaction) => {
        if (type === "note") {
            const [source] = await transaction
                .select()
                .from(note)
                .where(
                    and(
                        eq(note.id, id),
                        eq(note.isClear, false),
                        isNull(note.moderationArchivedAt),
                    ),
                )
                .limit(1);
            if (!source) throw new Error("This note is no longer awaiting review.");
            const review = assertStoredReview(source.aiReview ?? null, source.updatedAt);
            if (review.documentKind !== "past_paper") {
                throw new Error("The AI review does not classify this upload as a past paper.");
            }

            await transaction.delete(note).where(eq(note.id, id));
            await transaction.insert(pastPaper).values({
                id: source.id,
                authorId: source.authorId,
                contentHash: source.contentHash,
                courseId: review.suggestion.courseId ?? source.courseId,
                fileUrl: source.fileUrl,
                thumbNailUrl: source.thumbNailUrl,
                title: review.suggestion.title.trim() || source.title,
                examType: review.suggestion.examType,
                slot: review.suggestion.slot,
                year: review.suggestion.year,
                semester: review.suggestion.semester ?? "UNKNOWN",
                campus: review.suggestion.campus ?? "VELLORE",
                hasAnswerKey: review.suggestion.hasAnswerKey ?? false,
                isClear: false,
                createdAt: source.createdAt,
                updatedAt: new Date(),
            });
            return;
        }

        const [source] = await transaction
            .select()
            .from(pastPaper)
            .where(
                and(
                    eq(pastPaper.id, id),
                    eq(pastPaper.isClear, false),
                    isNull(pastPaper.moderationArchivedAt),
                ),
            )
            .limit(1);
        if (!source) throw new Error("This past paper is no longer awaiting review.");
        const review = assertStoredReview(source.aiReview ?? null, source.updatedAt);
        if (review.documentKind !== "notes") {
            throw new Error("The AI review does not classify this upload as notes.");
        }
        const [linkedAnswerKey] = await transaction
            .select({ id: pastPaper.id })
            .from(pastPaper)
            .where(
                and(
                    eq(pastPaper.questionPaperId, id),
                    isNull(pastPaper.moderationArchivedAt),
                ),
            )
            .limit(1);
        if (linkedAnswerKey) {
            throw new Error("Unlink the answer key before moving this paper to notes.");
        }

        await transaction.delete(pastPaper).where(eq(pastPaper.id, id));
        await transaction.insert(note).values({
            id: source.id,
            authorId: source.authorId,
            contentHash: source.contentHash,
            courseId: review.suggestion.courseId ?? source.courseId,
            fileUrl: source.fileUrl,
            thumbNailUrl: source.thumbNailUrl,
            title: review.suggestion.title.trim() || source.title,
            isClear: false,
            createdAt: source.createdAt,
            updatedAt: new Date(),
        });
    });

    const review = await reviewUploadedResource({ id, type: targetType, autoApprove: true });
    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
    await invalidatePastPapersSurfaceCache();
    return { review, targetType };
}

export async function applyAiModerationSuggestion(
    id: string,
    type: "note" | "pastPaper",
) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    if (type === "note") {
        const [row] = await db
            .select({
                aiReview: note.aiReview,
                courseId: note.courseId,
                title: note.title,
                updatedAt: note.updatedAt,
            })
            .from(note)
            .where(eq(note.id, id))
            .limit(1);
        if (!row) throw new Error("Note not found");
        const review = assertStoredReview(row.aiReview ?? null, row.updatedAt);
        const title = review.suggestion.title.trim();
        const titleChanged = row.title.replace(/\.pdf$/i, "").trim() !== title;
        const courseChanged =
            review.suggestion.courseId !== null &&
            row.courseId !== review.suggestion.courseId;
        if (!titleChanged && !courseChanged) {
            throw new Error("The AI review contains no verified changes to apply.");
        }
        const [updated] = await db
            .update(note)
            .set({
                ...(titleChanged ? { title } : {}),
                ...(courseChanged ? { courseId: review.suggestion.courseId } : {}),
                ...clearedModerationReview,
            })
            .where(
                and(
                    eq(note.id, id),
                    eq(note.updatedAt, row.updatedAt),
                    eq(note.isClear, false),
                    isNull(note.moderationArchivedAt),
                ),
            )
            .returning({ id: note.id });
        if (!updated) {
            throw new Error("This note changed before the suggestion was applied. Review it again.");
        }
    } else {
        const [row] = await db
            .select({
                aiReview: pastPaper.aiReview,
                campus: pastPaper.campus,
                courseId: pastPaper.courseId,
                examType: pastPaper.examType,
                hasAnswerKey: pastPaper.hasAnswerKey,
                questionPaperId: pastPaper.questionPaperId,
                semester: pastPaper.semester,
                slot: pastPaper.slot,
                title: pastPaper.title,
                updatedAt: pastPaper.updatedAt,
                year: pastPaper.year,
            })
            .from(pastPaper)
            .where(eq(pastPaper.id, id))
            .limit(1);
        if (!row) throw new Error("Past paper not found");
        const review = assertStoredReview(row.aiReview ?? null, row.updatedAt);
        const suggestion = review.suggestion;
        const title = suggestion.title.trim();
        const changesToQuestionPaper =
            row.hasAnswerKey && suggestion.hasAnswerKey === false;
        const [linkedAnswerKey] =
            suggestion.courseId !== null && row.courseId !== suggestion.courseId
                ? await db
                      .select({ courseId: pastPaper.courseId })
                      .from(pastPaper)
                      .where(
                          and(
                              eq(pastPaper.questionPaperId, id),
                              isNull(pastPaper.moderationArchivedAt),
                          ),
                      )
                      .limit(1)
                : [];
        const canChangeCourse =
            (!row.hasAnswerKey || changesToQuestionPaper) &&
            (!linkedAnswerKey || linkedAnswerKey.courseId === suggestion.courseId);
        const patch = {
            ...(row.title.replace(/\.pdf$/i, "").trim() !== title ? { title } : {}),
            ...(canChangeCourse &&
            suggestion.courseId !== null &&
            row.courseId !== suggestion.courseId
                ? { courseId: suggestion.courseId }
                : {}),
            ...(suggestion.examType !== null && row.examType !== suggestion.examType
                ? { examType: suggestion.examType }
                : {}),
            ...(suggestion.slot !== null && row.slot !== suggestion.slot
                ? { slot: suggestion.slot }
                : {}),
            ...(suggestion.year !== null && row.year !== suggestion.year
                ? { year: suggestion.year }
                : {}),
            ...(suggestion.semester !== null && row.semester !== suggestion.semester
                ? { semester: suggestion.semester }
                : {}),
            ...(suggestion.campus !== null && row.campus !== suggestion.campus
                ? { campus: suggestion.campus }
                : {}),
            ...(changesToQuestionPaper
                ? { hasAnswerKey: false, questionPaperId: null }
                : !row.hasAnswerKey && row.questionPaperId !== null
                  ? { questionPaperId: null }
                  : {}),
        };
        if (Object.keys(patch).length === 0) {
            throw new Error("The AI review contains no verified changes to apply.");
        }
        const [updated] = await db
            .update(pastPaper)
            .set({
                ...patch,
                ...clearedModerationReview,
            })
            .where(
                and(
                    eq(pastPaper.id, id),
                    eq(pastPaper.updatedAt, row.updatedAt),
                    eq(pastPaper.isClear, false),
                    isNull(pastPaper.moderationArchivedAt),
                ),
            )
            .returning({ id: pastPaper.id });
        if (!updated) {
            throw new Error("This paper changed before the suggestion was applied. Review it again.");
        }
    }

    const review = await reviewUploadedResource({ id, type, autoApprove: true });
    const appliedSuggestion = await readModerationSuggestion(id, type);
    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
    await invalidatePastPapersSurfaceCache();
    return { review, applied: appliedSuggestion };
}
