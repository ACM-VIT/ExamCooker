import React from "react";
import ClientSide from "./client-side";
import PostHogIdentify from "@/app/components/post-hog-identify";
import HomeFooter from "@/app/(app)/home/home-footer";

export default function Layout({
                                         children,
                                     }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            <PostHogIdentify />
            <ClientSide>
                <div className="flex min-h-screen min-w-0 flex-col">
                    <div className="min-h-screen min-w-0">
                        {children}
                    </div>
                    <HomeFooter />
                </div>
            </ClientSide>
        </>
    );
}
