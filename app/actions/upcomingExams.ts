"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { db, ExamType, upcomingExam } from "@/db";

const slotsSchema = z
    .array(z.string().min(1).max(20))
    .max(20)
    .default([]);

const upsertSchema = z.object({
    courseId: z.string().min(1),
    slots: slotsSchema,
    examType: z.nativeEnum(ExamType).nullable(),
    scheduledAt: z
        .string()
        .datetime()
        .nullable()
        .or(z.literal("").transform(() => null)),
});

async function requireModerator() {
    const session = await auth();
    // @ts-ignore — role is on user session
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }
}

export async function createUpcomingExam(input: z.input<typeof upsertSchema>) {
    await requireModerator();
    const parsed = upsertSchema.parse(input);
    await db.insert(upcomingExam).values({
        courseId: parsed.courseId,
        slots: parsed.slots,
        examType: parsed.examType,
        scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : null,
    });
    revalidateTag("upcoming_exams", "minutes");
    revalidatePath("/mod/upcoming");
    return { success: true };
}

export async function updateUpcomingExam(
    id: string,
    input: z.input<typeof upsertSchema>,
) {
    await requireModerator();
    const parsed = upsertSchema.parse(input);
    await db
        .update(upcomingExam)
        .set({
            courseId: parsed.courseId,
            slots: parsed.slots,
            examType: parsed.examType,
            scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : null,
        })
        .where(eq(upcomingExam.id, id));
    revalidateTag("upcoming_exams", "minutes");
    revalidatePath("/mod/upcoming");
    return { success: true };
}

export async function deleteUpcomingExam(id: string) {
    await requireModerator();
    await db.delete(upcomingExam).where(eq(upcomingExam.id, id));
    revalidateTag("upcoming_exams", "minutes");
    revalidatePath("/mod/upcoming");
    return { success: true };
}
