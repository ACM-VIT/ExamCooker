import React from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import BookmarksProvider from './components/BookmarksProvider';
import { Toaster } from "@/components/ui/toaster";
import { PrismaClient } from "@prisma/client";
import { auth } from "./auth";

export const metadata = {
    title: "ExamCooker 2024",
    description: "ACM-VIT 2024 ExamCooker Website",
    // metadataBase: new URL(""),
};
const plus_jakarta_sans = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const prisma = new PrismaClient()

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

    const initialBookmarks = [
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

    return (
        <html lang="en">
            <body className={`${plus_jakarta_sans.className} antialiased bg-[#C2E6EC] dark:bg-[#0C1222]`} style={{ margin: "0" }}>
                <SessionProvider>
                    <BookmarksProvider initialBookmarks={initialBookmarks}>
                        {children}
                    </BookmarksProvider>
                </SessionProvider>
                <Toaster />
            </body>
        </html>
    );
}
