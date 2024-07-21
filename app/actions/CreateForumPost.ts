'use server'

import { PrismaClient, Tag } from '@prisma/client'
import { auth } from '../auth'
import { error } from 'console'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

export async function createForumPost(inputData: CreateForumPostInput) {
  const status = true;
  try {
    const session = await auth();
    if(!session|| !session.user){
      return {
        success: false,
        error: "LOGIN KAR LODE",
      };
    }
    const tagConnections = [
      ...(inputData.year ? [await findOrCreateTag(inputData.year)] : []),
      ...(inputData.slot ? [await findOrCreateTag(inputData.slot)] : []),
      ...await Promise.all(inputData.selectedTags.map(tag => findOrCreateTag(tag)))
    ].map(tag => ({ id: tag.id }));

    const newForumPost = await prisma.forumPost.create({
      data: {
        title: inputData.title,
        author: {
          connect: { email: session.user.email!}
        },
        forum: {
          connect: { id: inputData.forumId }
        },
        description: inputData.description,
        tags: {
          connect: tagConnections
        }
      },
      include: {
        tags: true
      }
    });

    revalidatePath(`/forum`)
    return {success: true, data: newForumPost}
  } catch (error) {
    console.error('Failed to create forum post:', error)
    return { success: false, error: 'Failed to create forum post' }
  }  
}
