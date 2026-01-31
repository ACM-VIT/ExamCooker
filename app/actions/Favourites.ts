'use server'

import { PrismaClient } from '@/src/generated/prisma'
import { auth } from '../auth'
import { revalidateFavorites } from './revalidateFavourites'
import { revalidateTag } from "next/cache";

const prisma = new PrismaClient()
export type Bookmark = {
    id: string;
    type: 'note' | 'pastpaper' | 'forumpost' | 'subject';
    title: string;
};

export async function toggleBookmarkAction(bookmark: Bookmark, favourite: boolean) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('User not authenticated');
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                bookmarkedNotes: true,
                bookmarkedPastPapers: true,
                bookmarkedForumPosts: true,
                bookmarkedResources: true,
            },
        });

        if (!user) throw new Error('User not found');

        let bookmarkField: string;
        switch (bookmark.type) {
            case 'note':
                bookmarkField = 'bookmarkedNotes';
                break;
            case 'pastpaper':
                bookmarkField = 'bookmarkedPastPapers';
                break;
            case 'forumpost':
                bookmarkField = 'bookmarkedForumPosts';
                break;
            case 'subject':
                bookmarkField = 'bookmarkedResources';
                break;
            default:
                throw new Error(`Invalid bookmark type: ${bookmark.type}`);
        }

        await prisma.user.update({
            where: { email: session.user.email },
            data: {
                [bookmarkField]: {
                    [favourite ? 'connect' : 'disconnect']: { id: bookmark.id },
                },
            },
        });

        await revalidateFavorites(bookmark.type);
        if (user?.id) {
            revalidateTag("home", "minutes");
            revalidateTag(`home:${user.id}`, "minutes");
        }

        return { success: true, isBookmarked: favourite };
    } catch (error) {
        console.error('Error toggling bookmark:', error);
        return { success: false, error: 'Failed to toggle bookmark' };
    }
}
