import React from "react";
import ClientSide from "./clientSide";
import PostHogIdentify from "@/app/components/PostHogIdentify";
import AuthSessionProvider from "@/app/components/AuthSessionProvider";
import HomeFooter from "@/app/(app)/home/home_footer";

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
        <AuthSessionProvider>
            <PostHogIdentify />
            <ClientSide initialBookmarks={initialBookmarks}>
                <div className="flex min-h-screen min-w-0 flex-col">
                    <div className="min-h-screen min-w-0">
                        {children}
                    </div>
                    <HomeFooter />
                </div>
            </ClientSide>
        </AuthSessionProvider>
    );
}
