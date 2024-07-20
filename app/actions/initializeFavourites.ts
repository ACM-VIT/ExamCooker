import { PrismaClient } from "@prisma/client";
import { auth } from "../auth";

const prisma = new PrismaClient();

export async function initializeFavorites() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return [];
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
            return [
                ...user.bookmarkedNotes.map(note => ({ id: note.id, type: 'note', title: note.title })),
                ...user.bookmarkedPastPapers.map(paper => ({ id: paper.id, type: 'pastpaper', title: paper.title })),
                ...user.bookmarkedForumPosts.map(post => ({ id: post.id, type: 'forum', title: post.title })),
                ...user.bookmarkedResources.map(resource => ({ id: resource.id, type: 'subject', title: resource.name })),
            ];
        }

        return [];
    } catch (error) {
        console.error('Error initializing favorites:', error);
        return [];
    }
}
