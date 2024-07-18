'use server'

import { PrismaClient } from '@prisma/client'
import { auth } from '../auth'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

type CreateCommentInput = {
  content: string
  forumPostId: string
}


export async function createComment(data: CreateCommentInput) {
  try {
    const session = await auth();
    const newComment = await prisma.comment.create({
      data: {
        content: data.content,
        author: {
          connect: { email: session.user.email! }
        },
        forumPost: {
          connect: { id: data.forumPostId }
        }
      },
    })

    revalidatePath(`/forum/${data.forumPostId}`);
    return { success: true, data: newComment }
  } catch (error) {
    console.error('Server error creating comment:', error)
    return { success: false, error: 'Failed to create comment' }
  }
}