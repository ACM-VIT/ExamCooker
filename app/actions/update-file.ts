'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { auth } from '@/app/auth'
import { db, note, pastPaper } from '@/db'
import { invalidatePastPapersSurfaceCache } from '@/lib/cache/past-papers-surface-cache'

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
            await db.update(note).set({ title }).where(eq(note.id, itemID));
            revalidatePath('/notes');
            revalidateTag('notes', 'minutes');
            revalidateTag(`note:${itemID}`, 'minutes');
            await invalidatePastPapersSurfaceCache();
        } else {
            await db.update(pastPaper).set({ title }).where(eq(pastPaper.id, itemID));
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
