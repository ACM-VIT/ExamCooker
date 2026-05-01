"use client";

import { ReactNode, useState } from "react";
import HeroBackdropVideo from "./hero-backdrop-video";

export default function HeroFrame({ children }: { children: ReactNode }) {
    const [videoReady, setVideoReady] = useState(false);

    return (
        <div
            className={`relative transition-colors duration-500 ${
                videoReady ? "md:text-white dark:md:text-white" : ""
            }`}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden md:block"
            >
                <HeroBackdropVideo onReady={() => setVideoReady(true)} />
                <div className="absolute inset-0 bg-[#C2E6EC]/10 dark:bg-[hsl(224,48%,9%)]/45" />
                <div className="absolute inset-x-0 top-0 hidden h-32 bg-gradient-to-b to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                <div className="absolute inset-x-0 bottom-0 hidden h-32 bg-gradient-to-t to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                <div className="absolute inset-y-0 left-0 hidden w-32 bg-gradient-to-r to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                <div className="absolute inset-y-0 right-0 hidden w-32 bg-gradient-to-l to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
            </div>
            {children}
        </div>
    );
}
