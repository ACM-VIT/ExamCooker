'use server'

import { revalidatePath } from 'next/cache'
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient()
export async function upvotePost(postId: string) {
    try {
        const updatedPost = await prisma.forumPost.update({
            where: { id: postId },
            data: { upvoteCount: { increment: 1 } },
        })

        revalidatePath('/forums')
        return { success: true, upvoteCount: updatedPost.upvoteCount }
    } catch (error) {
        console.error('Error upvoting post:', error)
        return { success: false, error: 'Failed to upvote post' }
    }
}

export async function downvotePost(postId: string) {
    try {
        const updatedPost = await prisma.forumPost.update({
            where: { id: postId },
            data: { downvoteCount: { increment: 1 } },
        })

        revalidatePath('/forums')
        return { success: true, downvoteCount: updatedPost.downvoteCount }
    } catch (error) {
        console.error('Error downvoting post:', error)
        return { success: false, error: 'Failed to downvote post' }
    }
}
