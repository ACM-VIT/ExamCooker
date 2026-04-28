'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, note, pastPaper } from '@/db'

export async function updateFile(itemID: string, newTitle: string, activeTab: string) {

    if(activeTab === "notes") {
        try {
            const rows = await db
                .update(note)
                .set({ title: newTitle })
                .where(eq(note.id, itemID))
                .returning()

            const updatedNote = rows[0]

            revalidatePath('/notes') // Adjust this path as needed

            return { success: true, note: updatedNote }
        } catch (error) {
            console.error('Failed to update note:', error)
            return { success: false, error: 'Failed to update note' }
        }

    } else if (activeTab === "pastPaper") {
        try {
            const rows = await db
                .update(pastPaper)
                .set({ title: newTitle })
                .where(eq(pastPaper.id, itemID))
                .returning()

            const updatedPaper = rows[0]

            revalidatePath('/past_papers') // Adjust this path as needed

            return { success: true, note: updatedPaper }
        } catch (error) {
            console.error('Failed to update note:', error)
            return { success: false, error: 'Failed to update note' }
        }
    }



}
