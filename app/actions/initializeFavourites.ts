import { PrismaClient } from "@prisma/client";
import { auth } from "../auth";
import { useFavoritesStore } from "./StoredFavourites";

const prisma = new PrismaClient();

export async function initializeFavorites() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return;
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                bookmarkedNotes: true,
                bookmarkedPastPapers: true,
                bookmarkedForumPosts: true,
                bookmarkedResources: true,
            },
        });

        if (user) {
            const favorites = [
                ...user.bookmarkedNotes.map(note => ({ id: note.id, type: 'note' as const })),
                ...user.bookmarkedPastPapers.map(paper => ({ id: paper.id, type: 'pastPaper' as const })),
                ...user.bookmarkedForumPosts.map(post => ({ id: post.id, type: 'forum' as const })),
                ...user.bookmarkedResources.map(resource => ({ id: resource.id, type: 'subject' as const })),
            ];

            useFavoritesStore.getState().setInitialFavorites(favorites);
        }
    } catch (error) {
        console.error('Error initializing favorites:', error);
    }
}
