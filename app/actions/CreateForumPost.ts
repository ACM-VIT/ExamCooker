'use server'

import { PrismaClient, Tag } from '@prisma/client'
import { auth } from '../auth'
import { error } from 'console'

const prisma = new PrismaClient()

type CreateForumPostInput = {
  title: string
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
    const session = await auth();
    if(!session|| !session.user){
      return {
        success: false,
        error: "LOGIN KAR LODE",
      };
    }
    const tagConnections = [
      ...(data.year ? [await findOrCreateTag(data.year)] : []),
      ...(data.slot ? [await findOrCreateTag(data.slot)] : []),
      ...await Promise.all(data.selectedTags.map(tag => findOrCreateTag(tag)))
    ].map(tag => ({ id: tag.id }));

    const newForumPost = await prisma.forumPost.create({
      data: {
        title: data.title,
        author: {
          connect: { email: session.user.email!}
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
