import React from "react";
import LandingPageContent from "@/app/components/landing_page/landing";
import ThemeToggleSwitch from "../components/common/ThemeToggle";
import { SignIn } from "../components/sign-in";
import SessionRedirect from "@/app/components/SessionRedirect";

export default function Page() {
    return (
        <div className="min-h-screen flex flex-col">
            <SessionRedirect />
            <div className="transition-colors duration-200 ease-in flex flex-row-reverse items-center gap-6 py-4 px-6 border-b border-b-[#8DCAE9] dark:border-b-[#3BF4C7] overflow-hidden">
                <SignIn displayText="Sign In" />
                <ThemeToggleSwitch />
            </div>
            <LandingPageContent />
        </div>
    );
}
