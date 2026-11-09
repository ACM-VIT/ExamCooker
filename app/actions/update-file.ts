'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { auth } from '@/app/auth'
import { db, note, pastPaper } from '@/db'
import { invalidatePastPapersSurfaceCache } from '@/lib/cache/past-papers-surface-cache'
import { clearedModerationReview } from '@/lib/ai/moderation-review-types'

export type EditableTab = "notes" | "pastPaper";

type UpdateFileResult =
    | { success: true; title: string }
    | { success: false; error: string };

export async function updateFile(
    itemID: string,
    newTitle: string,
    activeTab: EditableTab,
): Promise<UpdateFileResult> {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") {
        return { success: false, error: "Access denied." };
    }

    const title = newTitle.trim();
    if (!title) {
        return { success: false, error: "Title cannot be empty." };
    }

    try {
        if (activeTab === "notes") {
            const updated = await db
                .update(note)
                .set({ title, ...clearedModerationReview })
                .where(and(eq(note.id, itemID), isNull(note.moderationArchivedAt)))
                .returning({ id: note.id });
            if (updated.length === 0) {
                return { success: false, error: "Item not found." };
            }
            revalidatePath('/notes');
            revalidateTag('notes', 'minutes');
            revalidateTag(`note:${itemID}`, 'minutes');
            await invalidatePastPapersSurfaceCache();
        } else {
            const updated = await db
                .update(pastPaper)
                .set({ title, ...clearedModerationReview })
                .where(
                    and(eq(pastPaper.id, itemID), isNull(pastPaper.moderationArchivedAt)),
                )
                .returning({ id: pastPaper.id });
            if (updated.length === 0) {
                return { success: false, error: "Item not found." };
            }
            revalidatePath('/past_papers');
            revalidateTag('past_papers', 'minutes');
            revalidateTag(`past_paper:${itemID}`, 'minutes');
            await invalidatePastPapersSurfaceCache();
        }

        return { success: true, title };
    } catch (error) {
        console.error(`Failed to update ${activeTab}:`, error)
        return { success: false, error: `Failed to update ${activeTab}.` }
    }
}
