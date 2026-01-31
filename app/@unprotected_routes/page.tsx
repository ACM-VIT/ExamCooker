"use client";

import React, { useEffect } from "react";
import LandingPageContent from "@/app/components/landing_page/landing";
import "@/app/globals.css";
import ThemeToggleSwitch from "../components/common/ThemeToggle";
import { SignIn } from "../components/sign-in";
import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

function LandingPageInner() {
    const { status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "authenticated") {
            router.replace("/home");
        }
    }, [status, router]);

    return (
        <div className="min-h-screen flex flex-col">
            <div className="transition-colors duration-200 ease-in flex flex-row-reverse items-center gap-6 py-4 px-6 border-b border-b-[#8DCAE9] dark:border-b-[#3BF4C7] overflow-hidden">
                <SignIn displayText="Sign In"/>
                <ThemeToggleSwitch />
            </div>
            <LandingPageContent />
        </div>
    );
}

export default function Page() {
    return (
        <SessionProvider>
            <LandingPageInner />
        </SessionProvider>
    );
}
