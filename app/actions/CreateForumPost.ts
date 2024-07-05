'use server'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type CreateForumPostInput = {
  title: string
  authorId: string
  forumId: string
  rating: number
}

export async function createForumPost(data: CreateForumPostInput) {
  try {
    const newForumPost = await prisma.forumPost.create({
      data: {
        title: data.title,
        author: {
          connect: { id: data.authorId } // //'cly0klo9800006hg6gwc73j5u'
        },
        forum: {
          connect: { id: data.forumId } //
        },
        rating: 0 //data.rating
      },
    })
    return { success: true, data: newForumPost }
  } catch (error) {
    console.error('Failed to create forum post:', error)
    return { success: false, error: 'Failed to create forum post' }
  }
}