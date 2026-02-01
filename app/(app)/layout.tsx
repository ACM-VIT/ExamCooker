import React from "react";
import {SessionProvider} from "next-auth/react";
import ClientSide from "./clientSide";
import PostHogIdentify from "@/app/components/PostHogIdentify";

export default function Layout({
                                         children,
                                     }: Readonly<{
    children: React.ReactNode;
}>) {
    const initialBookmarks: Array<{
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

    return (
        <SessionProvider>
            <PostHogIdentify />
            <ClientSide initialBookmarks={initialBookmarks}>
                {children}
            </ClientSide>
        </SessionProvider>
    );
}
