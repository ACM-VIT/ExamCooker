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
    return (
        <AuthSessionProvider>
            <PostHogIdentify />
            <ClientSide>
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
