"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { ExamType } from "@/prisma/generated/client";

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
    await prisma.upcomingExam.create({
        data: {
            courseId: parsed.courseId,
            slots: parsed.slots,
            examType: parsed.examType,
            scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : null,
        },
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
    await prisma.upcomingExam.update({
        where: { id },
        data: {
            courseId: parsed.courseId,
            slots: parsed.slots,
            examType: parsed.examType,
            scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : null,
        },
    });
    revalidateTag("upcoming_exams", "minutes");
    revalidatePath("/mod/upcoming");
    return { success: true };
}

export async function deleteUpcomingExam(id: string) {
    await requireModerator();
    await prisma.upcomingExam.delete({ where: { id } });
    revalidateTag("upcoming_exams", "minutes");
    revalidatePath("/mod/upcoming");
    return { success: true };
}
