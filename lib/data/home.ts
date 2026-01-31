import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";

export type HomeItem =
    | { type: "note"; item: { id: string; title: string } }
    | { type: "pastPaper"; item: { id: string; title: string } }
    | { type: "forumPost"; item: { id: string; title: string } }
    | { type: "subject"; item: { id: string; name: string } };

export async function getHomeRecentViews(userId: string): Promise<HomeItem[]> {
    "use cache";
    cacheTag("home");
    cacheTag(`home:${userId}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const recentViews = await prisma.viewHistory.findMany({
        where: { userId },
        orderBy: { viewedAt: "desc" },
        take: 3,
        include: {
            note: { select: { id: true, title: true } },
            pastPaper: { select: { id: true, title: true } },
            forumPost: { select: { id: true, title: true } },
            subject: { select: { id: true, name: true } },
        },
    });

    return recentViews
        .map((view) => {
            if (view.note) return { type: "note" as const, item: view.note };
            if (view.pastPaper) return { type: "pastPaper" as const, item: view.pastPaper };
            if (view.forumPost) return { type: "forumPost" as const, item: view.forumPost };
            if (view.subject) return { type: "subject" as const, item: view.subject };
            return null;
        })
        .filter((item): item is HomeItem => item !== null);
}

export async function getHomeFavorites(userId: string): Promise<HomeItem[]> {
    "use cache";
    cacheTag("home");
    cacheTag(`home:${userId}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            bookmarkedNotes: {
                take: 2,
                select: { id: true, title: true },
            },
            bookmarkedPastPapers: {
                take: 2,
                select: { id: true, title: true },
            },
            bookmarkedForumPosts: {
                take: 2,
                select: { id: true, title: true },
            },
            bookmarkedResources: {
                take: 2,
                select: { id: true, name: true },
            },
        },
    });

    if (!user) return [];

    const notes = user.bookmarkedNotes.map((note) => ({
        type: "note" as const,
        item: note,
    }));
    const pastPapers = user.bookmarkedPastPapers.map((paper) => ({
        type: "pastPaper" as const,
        item: paper,
    }));
    const forumPosts = user.bookmarkedForumPosts.map((post) => ({
        type: "forumPost" as const,
        item: post,
    }));
    const subjects = user.bookmarkedResources.map((subject) => ({
        type: "subject" as const,
        item: subject,
    }));

    return [...notes, ...pastPapers, ...forumPosts, ...subjects];
}
