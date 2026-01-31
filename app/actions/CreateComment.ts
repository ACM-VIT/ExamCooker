'use server'

import { PrismaClient } from '@/src/generated/prisma'
import { auth } from '../auth'
import { revalidatePath, revalidateTag } from 'next/cache'

const prisma = new PrismaClient()

type CreateCommentInput = {
  content: string
  forumPostId: string
}
interface NewComment {
  id: string;
  content: string;
  authorId: string;
  forumPostId: string;
  createdAt: Date;
  updatedAt: Date;
}


export async function createComment(data: CreateCommentInput): Promise<{ success: boolean; data?: NewComment; error?: string }> {
  try {
    const session = await auth();

    if (!session || !session.user) {
      throw new Error("Session or user is undefined");
    }
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
    revalidateTag("forum", "minutes");
    return { success: true, data: newComment }
  } catch (error) {
    console.error('Server error creating comment:', error)
    return { success: false, error: 'Failed to create comment' }
  }
}
