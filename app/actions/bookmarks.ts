'use server';

import { PrismaClient, Tag } from '@prisma/client';
import { auth } from '../auth';

const prisma = new PrismaClient();

export type Bookmark = {
    id: string;
    type: 'note' | 'pastpaper' | 'forumpost' | 'subject';
    title: string;
    upvoteCount?: number;
    downvoteCount?: number;
    votes?: { type: 'UPVOTE' | 'DOWNVOTE' }[];
    author?: { name: string | null };
    tags?: Tag[];
};

export async function getBookmarks(): Promise<Bookmark[]> {
    const session = await auth();
    if (!session?.user?.email) {
        return [];
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            bookmarkedNotes: true,
            bookmarkedPastPapers: true,
            bookmarkedForumPosts: {
                include: {
                    votes: true,
                    author: true,
                    tags: true,
                    comments: {
                        include: {
                            author: true,
                        },
                    },
                },
            },
            bookmarkedResources: true,
        },
    });

    if (!user) return [];

    return [
        ...user.bookmarkedNotes.map(note => ({ id: note.id, type: 'note' as const, title: note.title })),
        ...user.bookmarkedPastPapers.map(paper => ({ id: paper.id, type: 'pastpaper' as const, title: paper.title })),
        ...user.bookmarkedForumPosts.map(post => ({
            id: post.id,
            type: 'forumpost' as const,
            title: post.title,
            upvoteCount: post.upvoteCount,
            createdAt: post.createdAt,
            downvoteCount: post.downvoteCount,
            votes: post.votes.map(vote => ({ type: vote.type })),
            author: post.author ? { name: post.author.name } : undefined,
            tags: post.tags,
            comments: post.comments.map(comment => ({
                ...comment,
                author: comment.author ? { name: comment.author.name } : undefined,
            })),
        })),
        ...user.bookmarkedResources.map(resource => ({ id: resource.id, type: 'subject' as const, title: resource.name })),
    ];
}
