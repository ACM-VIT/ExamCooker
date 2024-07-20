"use server";
import { PrismaClient } from "@prisma/client";
import { auth } from "../auth";

const prisma = new PrismaClient();

type BookmarkType = 'note' | 'pastpaper' | 'forumpost' | 'subject';

export async function updateBookmark(itemType: BookmarkType, itemId: string, isFavorite: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: 'User not authenticated' };
    }

    const bookmarkField = getBookmarkField(itemType);

    if (isFavorite) {
      await prisma.user.update({
        where: { email: session.user.email },
        data: {
          [bookmarkField]: {
            connect: { id: itemId }
          }
        }
      });
    } else {
      await prisma.user.update({
        where: { email: session.user.email },
        data: {
          [bookmarkField]: {
            disconnect: { id: itemId }
          }
        }
      });
    }
    return { success: true };
  } catch (error) {
    console.error(`Error updating bookmarked ${itemType}:`, error);
    return { success: false, error: `Failed to update bookmarked ${itemType}` };
  }
}

function getBookmarkField(itemType: BookmarkType): string {
  switch (itemType) {
    case 'note':
      return 'bookmarkedNotes';
    case 'pastpaper':
      return 'bookmarkedPastPapers';
    case 'forumpost':
      return 'bookmarkedForumPosts';
    case 'subject':
      return 'bookmarkedResources';
    default:
      throw new Error(`Invalid item type: ${itemType as string}`);
  }
}
