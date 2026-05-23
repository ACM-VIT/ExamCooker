"use server";

import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { db, pastPaper } from "@/db";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import { campusValues, examTypeValues, semesterValues } from "@/db/enums";

const schema = z.object({
    id: z.string().min(1),
    courseId: z.string().min(1).nullable(),
    examType: z.enum(examTypeValues).nullable(),
    slot: z
        .string()
        .regex(/^[A-G][12]$/i, "Slot must match A1..G2")
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
        throw new Error("Access denied");
    }

    const parsed = schema.parse(input);

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
                .where(eq(pastPaper.id, parsed.id))
                .limit(1);

            if (!existingPaper) {
                throw new Error("Past paper not found.");
            }

            let nextQuestionPaperId: string | null = null;

            if (parsed.hasAnswerKey) {
                if (!parsed.questionPaperId) {
                    throw new Error("Answer keys must be linked to a question paper.");
                }

                if (parsed.questionPaperId === parsed.id) {
                    throw new Error("A paper cannot be linked to itself.");
                }

                const [questionPaper] = await tx
                    .select({
                        id: pastPaper.id,
                        title: pastPaper.title,
                        courseId: pastPaper.courseId,
                        hasAnswerKey: pastPaper.hasAnswerKey,
                    })
                    .from(pastPaper)
                    .where(eq(pastPaper.id, parsed.questionPaperId))
                    .limit(1);

                if (!questionPaper) {
                    throw new Error("Question paper not found.");
                }

                if (questionPaper.hasAnswerKey) {
                    throw new Error("Question paper cannot itself be marked as an answer key.");
                }

                if (
                    parsed.courseId !== null &&
                    questionPaper.courseId !== null &&
                    parsed.courseId !== questionPaper.courseId
                ) {
                    throw new Error("Answer key and question paper must belong to the same course.");
                }

                const [conflictingLink] = await tx
                    .select({
                        id: pastPaper.id,
                        title: pastPaper.title,
                    })
                    .from(pastPaper)
                    .where(
                        and(
                            eq(pastPaper.questionPaperId, parsed.questionPaperId),
                            ne(pastPaper.id, parsed.id),
                        ),
                    )
                    .limit(1);

                if (conflictingLink) {
                    throw new Error(
                        `Question paper already has an answer key linked: ${conflictingLink.title}`,
                    );
                }

                const [linkedAnswerKey] = await tx
                    .select({
                        id: pastPaper.id,
                        title: pastPaper.title,
                    })
                    .from(pastPaper)
                    .where(
                        and(
                            eq(pastPaper.questionPaperId, parsed.id),
                            ne(pastPaper.id, parsed.id),
                        ),
                    )
                    .limit(1);

                if (linkedAnswerKey) {
                    throw new Error(
                        `This paper already has an answer key linked: ${linkedAnswerKey.title}`,
                    );
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
                })
                .where(eq(pastPaper.id, parsed.id));

            return {
                questionPaperId: nextQuestionPaperId,
                previousQuestionPaperId: existingPaper.questionPaperId,
            };
        });

        questionPaperId = result.questionPaperId;
        previousQuestionPaperId = result.previousQuestionPaperId;
    } catch (error) {
        if (isQuestionPaperLinkUniqueConstraintError(error)) {
            throw new Error("Question paper already has an answer key linked.");
        }

        throw error;
    }

    revalidatePath("/mod/papers/review");
    revalidateTag("past_papers", "minutes");
    revalidateTag(`past_paper:${parsed.id}`, "minutes");
    if (previousQuestionPaperId) {
        revalidateTag(`past_paper:${previousQuestionPaperId}`, "minutes");
    }
    if (questionPaperId) {
        revalidateTag(`past_paper:${questionPaperId}`, "minutes");
    }
    revalidateTag("courses", "minutes");
    await invalidatePastPapersSurfaceCache();
    return { success: true };
}
