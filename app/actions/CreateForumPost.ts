'use server'

import { PrismaClient, Tag } from '@prisma/client'

const prisma = new PrismaClient()

type CreateForumPostInput = {
  title: string
  authorId: string
  forumId: string
  description: string
  year: string
  subject: string
  slot: string
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
    const yearTag = await findOrCreateTag(data.year);
    const subjectTag = await findOrCreateTag(data.subject);
    const slotTag = await findOrCreateTag(data.slot);

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
          connect: [
            { id: yearTag.id },
            { id: subjectTag.id },
            { id: slotTag.id }
          ]
        }
      },
      include: {
        tags: true // This will include the connected tags in the response
      }
    });

    return { success: true, data: newForumPost }
  } catch (error) {
    console.error('Failed to create forum post:', error)
    return { success: false, error: 'Failed to create forum post' }
  }
}