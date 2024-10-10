'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient();

export async function updateFile(itemID: string, newTitle: string, activeTab: string) {

    if(activeTab === "notes") {
        try {
            const updatedNote = await prisma.note.update({
            where: { id: itemID },
            data: { 
                title: newTitle
            },
            })

            revalidatePath('/notes') // Adjust this path as needed

            return { success: true, note: updatedNote }
        } catch (error) {
            console.error('Failed to update note:', error)
            return { success: false, error: 'Failed to update note' }
        }

    } else if (activeTab === "pastPaper") {
        try {
            const updatedPaper = await prisma.pastPaper.update({
            where: { id: itemID },
            data: { 
                title: newTitle
            },
            })

            revalidatePath('/past_papers') // Adjust this path as needed

            return { success: true, note: updatedPaper }
        } catch (error) {
            console.error('Failed to update note:', error)
            return { success: false, error: 'Failed to update note' }
        }
    }



}