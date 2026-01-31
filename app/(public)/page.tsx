import React from "react";
import LandingPageContent from "@/app/components/landing_page/landing";
import ThemeToggleSwitch from "../components/common/ThemeToggle";
import { SignIn } from "../components/sign-in";
import { auth } from "@/app/auth";
import { redirect } from "next/navigation";

export default async function Page() {
    const session = await auth();

    if (session?.user) {
        redirect("/home");
    }

    return (
        <div className="min-h-screen flex flex-col">
            <div className="transition-colors duration-200 ease-in flex flex-row-reverse items-center gap-6 py-4 px-6 border-b border-b-[#8DCAE9] dark:border-b-[#3BF4C7] overflow-hidden">
                <SignIn displayText="Sign In" />
                <ThemeToggleSwitch />
            </div>
            <LandingPageContent />
        </div>
    );
}
