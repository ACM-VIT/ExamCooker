'use server'

import { PrismaClient, Tag } from '@prisma/client'

const prisma = new PrismaClient()

type CreateForumPostInput = {
  title: string
  authorId: string
  forumId: string
  description: string
  year?: string
  slot?: string
  selectedTags: string[]
}

async function findOrCreateTag(name: string): Promise<Tag> {
  let tag = await prisma.tag.findUnique({ where: { name } });
  if (!tag) {
    tag = await prisma.tag.create({ data: { name } });
  }
  return tag;
}

export async function createForumPost(data: CreateForumPostInput) {
  try {
    const tagConnections = [
      ...(data.year ? [await findOrCreateTag(data.year)] : []),
      ...(data.slot ? [await findOrCreateTag(data.slot)] : []),
      ...await Promise.all(data.selectedTags.map(tag => findOrCreateTag(tag)))
    ].map(tag => ({ id: tag.id }));

    const newForumPost = await prisma.forumPost.create({
      data: {
        title: data.title,
        author: {
          connect: { id: data.authorId }
        },
        forum: {
          connect: { id: data.forumId }
        },
        description: data.description,
        tags: {
          connect: tagConnections
        }
      },
      include: {
        tags: true
      }
    });

    return { success: true, data: newForumPost }
  } catch (error) {
    console.error('Failed to create forum post:', error)
    return { success: false, error: 'Failed to create forum post' }
  }
}
