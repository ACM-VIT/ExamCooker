"use server";

import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { db, pastPaper } from "@/db";
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

export async function updatePaperMetadata(input: UpdatePaperMetadataInput) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const parsed = schema.parse(input);

    let questionPaperId: string | null = null;

    if (parsed.hasAnswerKey) {
        if (!parsed.questionPaperId) {
            throw new Error("Answer keys must be linked to a question paper.");
        }

        if (parsed.questionPaperId === parsed.id) {
            throw new Error("A paper cannot be linked to itself.");
        }

        const [questionPaper] = await db
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

        const [conflictingLink] = await db
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

        questionPaperId = questionPaper.id;
    }

    await db
        .update(pastPaper)
        .set({
            courseId: parsed.courseId,
            examType: parsed.examType,
            slot: parsed.slot,
            year: parsed.year,
            semester: parsed.semester,
            campus: parsed.campus,
            hasAnswerKey: parsed.hasAnswerKey,
            questionPaperId,
        })
        .where(eq(pastPaper.id, parsed.id));

    revalidatePath("/mod/papers/review");
    revalidateTag("past_papers", "minutes");
    revalidateTag(`past_paper:${parsed.id}`, "minutes");
    if (questionPaperId) {
        revalidateTag(`past_paper:${questionPaperId}`, "minutes");
    }
    revalidateTag("courses", "minutes");
    return { success: true };
}
