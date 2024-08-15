import "@/app/globals.css";
import React from "react";
import {auth} from "@/app/auth";
import {redirect} from "next/navigation";
import {SessionProvider} from "next-auth/react";
import ClientSide from "./clientSide";
import {PrismaClient} from "@prisma/client";
import BookmarksProvider from "@/app/components/BookmarksProvider";

export default async function Layout({
                                         children,
                                     }: Readonly<{
    children: React.ReactNode;
}>) {
    const prisma = new PrismaClient();

    const session = await auth();
    if (!session?.user?.email) {
        return redirect("/landing");
    }

    const user = await prisma.user.findUnique({
        where: {email: session.user.email},
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

    if (!user) return redirect("/landing");

    const initialBookmarks = [
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

    return (
        <SessionProvider>
            <ClientSide>
                <BookmarksProvider initialBookmarks={initialBookmarks}>
                    {children}
                </BookmarksProvider>
            </ClientSide>
        </SessionProvider>
    );
}
