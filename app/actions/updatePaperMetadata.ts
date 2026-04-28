"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { Campus, db, ExamType, pastPaper, Semester } from "@/src/db";

const schema = z.object({
    id: z.string().min(1),
    courseId: z.string().min(1).nullable(),
    examType: z.nativeEnum(ExamType).nullable(),
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
    semester: z.nativeEnum(Semester),
    campus: z.nativeEnum(Campus),
    hasAnswerKey: z.boolean(),
});

export type UpdatePaperMetadataInput = z.input<typeof schema>;

export async function updatePaperMetadata(input: UpdatePaperMetadataInput) {
    const session = await auth();
    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const parsed = schema.parse(input);

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
        })
        .where(eq(pastPaper.id, parsed.id));

    revalidatePath("/mod/papers/review");
    revalidateTag("past_papers", "minutes");
    revalidateTag("courses", "minutes");
    return { success: true };
}
