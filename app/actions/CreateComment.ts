'use server'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type CreateCommentInput = {
  content: string
  authorId: string
  forumPostId: string
}

export async function createComment(data: CreateCommentInput) {
  try {
    const newComment = await prisma.comment.create({
      data: {
        content: data.content,
        author: {
          connect: { id: data.authorId }
        },
        forumPost: {
          connect: { id: data.forumPostId }
        }
      },
    })
    return { success: true, data: newComment }
  } catch (error) {
    console.error('Server error creating comment:', error)
    return { success: false, error: 'Failed to create comment' }
  }
}