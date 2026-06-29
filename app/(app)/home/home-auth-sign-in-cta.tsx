"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { SignIn } from "@/app/components/sign-in";

function GradientText({ children }: { children: ReactNode }) {
    return (
        <span className="bg-gradient-to-tr from-[#253EE0] to-[#27BAEC] bg-clip-text text-transparent">
            {children}
        </span>
    );
}

function WordBetweenLine({ children }: { children: ReactNode }) {
    return (
        <div className="relative flex items-center justify-between gap-3 md:gap-6">
            <div className="flex-grow border-t border-black dark:border-[#D5D5D5]" />
            <span className="min-w-0 flex-shrink text-center text-3xl font-extrabold text-black dark:text-[#D5D5D5] md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl [@media(max-height:560px)]:lg:text-3xl [@media(max-height:720px)]:lg:text-4xl">
                {children}
            </span>
            <div className="flex-grow border-t border-black dark:border-[#D5D5D5]" />
        </div>
    );
}

export default function HomeAuthSignInCta() {
    const [showSignIn, setShowSignIn] = useState(false);

    useEffect(() => {
        let active = true;

        void import("next-auth/react")
            .then(({ getSession }) => getSession())
            .then((session) => {
                if (active) {
                    setShowSignIn(!session?.user);
                }
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, []);

    if (!showSignIn) return null;

    return (
        <section className="relative z-20 min-h-screen overflow-hidden bg-[#8DCAE9] px-4 py-16 dark:bg-[#0C1222] md:py-24 lg:sticky lg:top-0 lg:min-h-screen lg:py-12">
            <div className="pointer-events-none absolute -right-32 -top-32 size-[22rem] rounded-full bg-[#3BF4C7]/25 blur-[140px] dark:bg-[#3BF4C7]/20" />
            <div className="pointer-events-none absolute -bottom-32 -left-32 size-[22rem] rounded-full bg-[#253EE0]/20 blur-[140px] dark:bg-[#27BAEC]/25" />

            <div className="relative flex min-h-[inherit] flex-col justify-center gap-8">
                <div className="mx-auto w-full max-w-6xl xl:max-w-7xl">
                    <WordBetweenLine>
                        <div className="text-center">
                            Start <GradientText>Cooking</GradientText> Your
                            <br /> Academic <GradientText>Success</GradientText> Today
                        </div>
                    </WordBetweenLine>
                </div>
                <div className="relative grid justify-center gap-8">
                    <SignIn displayText="Sign In" />
                </div>
            </div>
        </section>
    );
}
