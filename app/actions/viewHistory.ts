'use server'

import { PrismaClient, Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

type ViewableItemType = 'pastPaper' | 'note' | 'forumPost' | 'subject'

export async function recordViewHistory(itemType: ViewableItemType, itemId: string, userId: string) {
    try {
        let whereClause: Prisma.ViewHistoryWhereUniqueInput

        switch (itemType) {
            case 'pastPaper':
                whereClause = { userId_pastPaperId: { userId, pastPaperId: itemId } }
                break
            case 'note':
                whereClause = { userId_noteId: { userId, noteId: itemId } }
                break
            case 'forumPost':
                whereClause = { userId_forumPostId: { userId, forumPostId: itemId } }
                break
            case 'subject':
                whereClause = { userId_subjectId: { userId, subjectId: itemId } }
                break
            default:
                throw new Error('Invalid item type')
        }

        await prisma.viewHistory.upsert({
            where: whereClause,
            update: {
                viewedAt: new Date(),
            },
            create: {
                userId,
                [`${itemType}Id`]: itemId,
                viewedAt: new Date(),
            },
        })
        revalidatePath('/')
        return { success: true }
    } catch (error) {
        console.error('Failed to record view history:', error)
        return { success: false, error: 'Failed to record view history' }
    }
}
