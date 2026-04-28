'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, note, pastPaper } from '@/db'

export type EditableTab = "notes" | "pastPaper";

type UpdateFileResult =
    | { success: true; title: string }
    | { success: false; error: string };

export async function updateFile(
    itemID: string,
    newTitle: string,
    activeTab: EditableTab,
): Promise<UpdateFileResult> {
    const title = newTitle.trim();
    if (!title) {
        return { success: false, error: "Title cannot be empty." };
    }

    try {
        if (activeTab === "notes") {
            await db.update(note).set({ title }).where(eq(note.id, itemID));
            revalidatePath('/notes');
        } else {
            await db.update(pastPaper).set({ title }).where(eq(pastPaper.id, itemID));
            revalidatePath('/past_papers');
        }

        return { success: true, title };
    } catch (error) {
        console.error(`Failed to update ${activeTab}:`, error)
        return { success: false, error: `Failed to update ${activeTab}.` }
    }
}
