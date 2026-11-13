"use server";

import { z } from "zod";
import { and, eq, isNull, ne } from "drizzle-orm";
import { auth } from "@/app/auth";
import { revalidatePath, updateTag } from "next/cache";
import { db, pastPaper } from "@/db";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import { campusValues, examTypeValues, semesterValues } from "@/db/enums";
import { clearedModerationReview } from "@/lib/ai/moderation-review-types";

const schema = z.object({
    id: z.string().min(1),
    courseId: z.string().min(1).nullable(),
    examType: z.enum(examTypeValues).nullable(),
    slot: z
        .string()
        .trim()
        .regex(/^[A-Z][A-Z0-9]*(\+[A-Z][A-Z0-9]*)*$/i, "Enter a slot such as A1 or A1+TA1.")
        .transform((v) => v.toUpperCase())
        .nullable()
        .or(z.literal("").transform(() => null)),
    year: z
        .number()
        .int()
        .min(2000)
        .max(2100)
        .nullable()
        .or(z.nan().transform(() => null)),
    semester: z.enum(semesterValues),
    campus: z.enum(campusValues),
    hasAnswerKey: z.boolean(),
    questionPaperId: z.string().min(1).nullable(),
});

export type UpdatePaperMetadataInput = z.input<typeof schema>;

function isQuestionPaperLinkUniqueConstraintError(error: unknown) {
    if (error instanceof Error && error.cause) {
        error = error.cause;
    }
    if (!error || typeof error !== "object") {
        return false;
    }

    const code =
        typeof (error as { code?: unknown }).code === "string"
            ? (error as { code: string }).code
            : "";
    if (code !== "23505") {
        return false;
    }

    const constraint =
        typeof (error as { constraint?: unknown }).constraint === "string"
            ? (error as { constraint: string }).constraint
            : "";
    const message =
        typeof (error as { message?: unknown }).message === "string"
            ? (error as { message: string }).message.toLowerCase()
            : "";

    return (
        constraint === "PastPaper_questionPaperId_key" ||
        message.includes("pastpaper_questionpaperid_key")
    );
}

export async function updatePaperMetadata(input: UpdatePaperMetadataInput) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") {
        return { success: false as const, error: "Access denied." };
    }

    const validation = schema.safeParse(input);
    if (!validation.success) {
        const { path, message } = validation.error.issues[0];
        return { success: false as const, error: `${path.join(".") || "Metadata"}: ${message}` };
    }
    const parsed = validation.data;

    let questionPaperId: string | null = null;
    let previousQuestionPaperId: string | null = null;

    try {
        const result = await db.transaction(async (tx) => {
            const [existingPaper] = await tx
                .select({
                    id: pastPaper.id,
                    questionPaperId: pastPaper.questionPaperId,
                })
                .from(pastPaper)
                .where(
                    and(
                        eq(pastPaper.id, parsed.id),
                        isNull(pastPaper.moderationArchivedAt),
                    ),
                )
                .limit(1);

            if (!existingPaper) {
                return { success: false as const, error: "Past paper not found." };
            }

            let nextQuestionPaperId: string | null = null;

            if (parsed.hasAnswerKey && parsed.questionPaperId) {
                if (parsed.questionPaperId === parsed.id) {
                    return { success: false as const, error: "A paper cannot be linked to itself." };
                }

                const [linkedAnswerKey] = await tx
                    .select({ title: pastPaper.title })
                    .from(pastPaper)
                    .where(
                        and(
                            eq(pastPaper.questionPaperId, parsed.id),
                            ne(pastPaper.id, parsed.id),
                        ),
                    )
                    .limit(1);

                if (linkedAnswerKey) {
                    return {
                        success: false as const,
                        error: `This paper already has an answer key linked: ${linkedAnswerKey.title}`,
                    };
                }
                const [questionPaper] = await tx
                    .select({
                        id: pastPaper.id,
                        courseId: pastPaper.courseId,
                        questionPaperId: pastPaper.questionPaperId,
                    })
                    .from(pastPaper)
                    .where(eq(pastPaper.id, parsed.questionPaperId))
                    .limit(1);

                if (!questionPaper) {
                    return { success: false as const, error: "Question paper not found." };
                }

                if (questionPaper.questionPaperId) {
                    return { success: false as const, error: "The selected paper already links to a separate question paper." };
                }

                if (
                    parsed.courseId !== null &&
                    questionPaper.courseId !== null &&
                    parsed.courseId !== questionPaper.courseId
                ) {
                    return { success: false as const, error: "Answer key and question paper must belong to the same course." };
                }

                const [conflictingLink] = await tx
                    .select({ title: pastPaper.title })
                    .from(pastPaper)
                    .where(
                        and(
                            eq(pastPaper.questionPaperId, parsed.questionPaperId),
                            ne(pastPaper.id, parsed.id),
                        ),
                    )
                    .limit(1);

                if (conflictingLink) {
                    return {
                        success: false as const,
                        error: `Question paper already has an answer key linked: ${conflictingLink.title}`,
                    };
                }

                nextQuestionPaperId = questionPaper.id;
            }

            await tx
                .update(pastPaper)
                .set({
                    courseId: parsed.courseId,
                    examType: parsed.examType,
                    slot: parsed.slot,
                    year: parsed.year,
                    semester: parsed.semester,
                    campus: parsed.campus,
                    hasAnswerKey: parsed.hasAnswerKey,
                    questionPaperId: nextQuestionPaperId,
                    ...clearedModerationReview,
                })
                .where(
                    and(
                        eq(pastPaper.id, parsed.id),
                        isNull(pastPaper.moderationArchivedAt),
                    ),
                );

            return {
                success: true as const,
                questionPaperId: nextQuestionPaperId,
                previousQuestionPaperId: existingPaper.questionPaperId,
            };
        });

        if (!result.success) return result;
        questionPaperId = result.questionPaperId;
        previousQuestionPaperId = result.previousQuestionPaperId;
    } catch (error) {
        if (isQuestionPaperLinkUniqueConstraintError(error)) {
            return { success: false as const, error: "Question paper already has an answer key linked." };
        }

        throw error;
    }

    await invalidatePastPapersSurfaceCache();
    revalidatePath("/mod/papers/review");
    updateTag("past_papers");
    updateTag(`past_paper:${parsed.id}`);
    if (previousQuestionPaperId) {
        updateTag(`past_paper:${previousQuestionPaperId}`);
    }
    if (questionPaperId) {
        updateTag(`past_paper:${questionPaperId}`);
    }
    updateTag("courses");
    return { success: true as const };
}
