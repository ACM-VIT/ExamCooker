import React from "react";
import {auth} from "@/app/auth";
import {SessionProvider} from "next-auth/react";
import ClientSide from "./clientSide";
import {PrismaClient} from "@/src/generated/prisma";

export default async function Layout({
                                         children,
                                     }: Readonly<{
    children: React.ReactNode;
}>) {
    const prisma = new PrismaClient();

    const session = await auth();
    let initialBookmarks: Array<{
        id: string;
        type: "note" | "pastpaper" | "forumpost" | "subject";
        title: string;
        thumbNailUrl?: string | null;
        upvoteCount?: number;
        createdAt?: Date;
        downvoteCount?: number;
        votes?: Array<{type: string}>;
        author?: {name: string | null};
        tags?: Array<{id: string; name: string}>;
        comments?: Array<{
            id: string;
            content: string;
            createdAt: Date;
            updatedAt: Date;
            author?: {name: string | null};
        }>;
    }> = [];

    if (session?.user?.email) {
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

        if (user) {
            initialBookmarks = [
                ...user.bookmarkedNotes.map((note) => ({
                    id: note.id,
                    type: "note" as const,
                    title: note.title,
                    thumbNailUrl: note.thumbNailUrl,
                })),
                ...user.bookmarkedPastPapers.map((paper) => ({
                    id: paper.id,
                    type: "pastpaper" as const,
                    title: paper.title,
                    thumbNailUrl: paper.thumbNailUrl,
                })),
                ...user.bookmarkedForumPosts.map((post) => ({
                    id: post.id,
                    type: "forumpost" as const,
                    title: post.title,
                    upvoteCount: post.upvoteCount,
                    createdAt: post.createdAt,
                    downvoteCount: post.downvoteCount,
                    votes: post.votes.map((vote) => ({type: vote.type})),
                    author: post.author ? {name: post.author.name} : undefined,
                    tags: post.tags,
                    comments: post.comments.map((comment) => ({
                        ...comment,
                        author: comment.author
                            ? {name: comment.author.name}
                            : undefined,
                    })),
                })),
                ...user.bookmarkedResources.map((resource) => ({
                    id: resource.id,
                    type: "subject" as const,
                    title: resource.name,
                })),
            ];
        }
    }

    return (
        <SessionProvider>
            <ClientSide initialBookmarks={initialBookmarks}>
                {children}
            </ClientSide>
        </SessionProvider>
    );
}
