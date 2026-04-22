"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";

const schema = z.object({
    id: z.string().min(1),
    courseId: z.string().min(1).nullable(),
});

export type UpdateNoteCourseInput = z.input<typeof schema>;

export async function updateNoteCourse(input: UpdateNoteCourseInput) {
    const session = await auth();
    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const parsed = schema.parse(input);

    await prisma.note.update({
        where: { id: parsed.id },
        data: { courseId: parsed.courseId },
    });

    revalidatePath("/mod/notes/review");
    revalidateTag("courses", "minutes");
    return { success: true };
}
