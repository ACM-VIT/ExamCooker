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
    const title = inputData.title.trim();
    const description = inputData.description.trim();

    if (!email) {
      return {
        success: false,
        error: "You must be signed in to create a forum post.",
      };
    }

    if (!title) {
      return { success: false, error: "Title is required." };
    }

    if (!description) {
      return { success: false, error: "Description is required." };
    }

    const author = await requireUserByEmail(email);
    const tagRecords = await Promise.all(
      collectTagNames(inputData).map((tagName) => findOrCreateTag(tagName)),
    );

    const [newForumPost] = await db
      .insert(forumPost)
      .values({
        title,
        authorId: author.id,
        forumId: inputData.forumId,
        description,
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
