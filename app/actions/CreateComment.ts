'use server'

import { auth } from '../auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { comment, db, type Comment } from '@/src/db'
import { requireUserByEmail } from '@/src/db/helpers'

type CreateCommentInput = {
  content: string
  forumPostId: string
}

export async function createComment(
  data: CreateCommentInput,
): Promise<{ success: boolean; data?: Comment; error?: string }> {
  try {
    const session = await auth()
    const email = session?.user?.email
    const content = data.content.trim()

    if (!email) {
      throw new Error('Session or user is undefined')
    }

    if (!content) {
      return { success: false, error: 'Comment cannot be empty' }
    }

    const author = await requireUserByEmail(email)
    const [newComment] = await db
      .insert(comment)
      .values({
        content,
        authorId: author.id,
        forumPostId: data.forumPostId,
      })
      .returning()

    if (!newComment) {
      throw new Error('Failed to create comment')
    }

    revalidatePath(`/forum/${data.forumPostId}`)
    revalidateTag('forum', 'minutes')
    return { success: true, data: newComment }
  } catch (error) {
    console.error('Server error creating comment:', error)
    return { success: false, error: 'Failed to create comment' }
  }
}
