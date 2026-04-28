"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { db, note } from "@/src/db";

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

    await db
        .update(note)
        .set({ courseId: parsed.courseId })
        .where(eq(note.id, parsed.id));

    revalidatePath("/mod/notes/review");
    revalidateTag("notes", "minutes");
    revalidateTag("courses", "minutes");
    return { success: true };
}
