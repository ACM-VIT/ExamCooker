'use server'

import { auth } from '../auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { db, forumPost, forumPostToTag } from '@/db'
import { findOrCreateTag, requireUserByEmail } from '@/db/helpers'

type CreateForumPostInput = {
  title: string
  forumId: string
  description: string
  year?: string
  slot?: string
  selectedTags: string[]
}

function collectTagNames(inputData: CreateForumPostInput) {
  return Array.from(
    new Set(
      [
        inputData.year?.trim(),
        inputData.slot?.trim(),
        ...inputData.selectedTags.map((tag) => tag.trim()),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

export async function createForumPost(inputData: CreateForumPostInput) {
  try {
    const session = await auth();
    const email = session?.user?.email;

    if (!email) {
      return {
        success: false,
        error: "LOGIN KAR LODE",
      };
    }

    const author = await requireUserByEmail(email);
    const tagRecords = await Promise.all(
      collectTagNames(inputData).map((tagName) => findOrCreateTag(tagName)),
    );

    const [newForumPost] = await db
      .insert(forumPost)
      .values({
        title: inputData.title.trim(),
        authorId: author.id,
        forumId: inputData.forumId,
        description: inputData.description.trim(),
      })
      .returning();

    if (!newForumPost) {
      throw new Error("Failed to create forum post");
    }

    if (tagRecords.length > 0) {
      await db
        .insert(forumPostToTag)
        .values(tagRecords.map((tag) => ({ a: newForumPost.id, b: tag.id })))
        .onConflictDoNothing();
    }

    revalidatePath('/forum')
    revalidateTag('forum', 'minutes')
    return {
      success: true,
      data: {
        ...newForumPost,
        tags: tagRecords,
      },
    }
  } catch (error) {
    console.error('Failed to create forum post:', error)
    return { success: false, error: 'Failed to create forum post' }
  }
}
