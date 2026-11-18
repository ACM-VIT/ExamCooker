"use server";

import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { db, note } from "@/db";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import { clearedModerationReview } from "@/lib/ai/moderation-review-types";

const schema = z.object({
    id: z.string().min(1),
    courseId: z.string().min(1).nullable(),
});

export type UpdateNoteCourseInput = z.input<typeof schema>;

export async function updateNoteCourse(input: UpdateNoteCourseInput) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const parsed = schema.parse(input);

    const updated = await db
        .update(note)
        .set({ courseId: parsed.courseId, ...clearedModerationReview })
        .where(and(eq(note.id, parsed.id), isNull(note.moderationArchivedAt)))
        .returning({ id: note.id });
    if (updated.length === 0) throw new Error("Note not found.");

    revalidatePath("/mod/notes/review");
    revalidateTag("notes", "minutes");
    revalidateTag("courses", "minutes");
    await invalidatePastPapersSurfaceCache();
    return { success: true };
}
