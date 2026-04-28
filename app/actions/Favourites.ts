'use server'

import { and, eq } from "drizzle-orm";
import { auth } from '../auth'
import { revalidateFavorites } from './revalidateFavourites'
import { revalidateTag } from "next/cache";
import {
    db,
    userBookmarkedForumPosts,
    userBookmarkedNotes,
    userBookmarkedPastPapers,
    userBookmarkedResources,
} from "@/src/db";
import { requireUserByEmail } from "@/src/db/helpers";

export type Bookmark = {
    id: string;
    type: 'note' | 'pastpaper' | 'forumpost' | 'subject';
    title: string;
};

export async function toggleBookmarkAction(bookmark: Bookmark, favourite: boolean) {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) {
        throw new Error('User not authenticated');
    }

    try {
        const user = await requireUserByEmail(email);

        const joinRow = (() => {
            switch (bookmark.type) {
                case 'note':
                    return {
                        table: userBookmarkedNotes,
                        row: { a: bookmark.id, b: user.id },
                        where: and(
                            eq(userBookmarkedNotes.a, bookmark.id),
                            eq(userBookmarkedNotes.b, user.id),
                        ),
                    };
                case 'pastpaper':
                    return {
                        table: userBookmarkedPastPapers,
                        row: { a: bookmark.id, b: user.id },
                        where: and(
                            eq(userBookmarkedPastPapers.a, bookmark.id),
                            eq(userBookmarkedPastPapers.b, user.id),
                        ),
                    };
                case 'forumpost':
                    return {
                        table: userBookmarkedForumPosts,
                        row: { a: bookmark.id, b: user.id },
                        where: and(
                            eq(userBookmarkedForumPosts.a, bookmark.id),
                            eq(userBookmarkedForumPosts.b, user.id),
                        ),
                    };
                case 'subject':
                    return {
                        table: userBookmarkedResources,
                        row: { a: bookmark.id, b: user.id },
                        where: and(
                            eq(userBookmarkedResources.a, bookmark.id),
                            eq(userBookmarkedResources.b, user.id),
                        ),
                    };
                default:
                    throw new Error(`Invalid bookmark type: ${bookmark.type}`);
            }
        })();

        if (favourite) {
            await db.insert(joinRow.table).values(joinRow.row).onConflictDoNothing();
        } else {
            await db.delete(joinRow.table).where(joinRow.where);
        }

        await revalidateFavorites(bookmark.type);
        revalidateTag("home", "minutes");
        revalidateTag(`home:${user.id}`, "minutes");

        return { success: true, isBookmarked: favourite };
    } catch (error) {
        console.error('Error toggling bookmark:', error);
        return { success: false, error: 'Failed to toggle bookmark' };
    }
}
