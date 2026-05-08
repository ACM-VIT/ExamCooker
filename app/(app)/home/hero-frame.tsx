"use client";

import { ReactNode, useCallback, useState } from "react";
import HeroBackdropVideo from "./hero-backdrop-video";

export default function HeroFrame({ children }: { children: ReactNode }) {
    const [videoReady, setVideoReady] = useState(false);
    const [youtubeEngaged, setYoutubeEngaged] = useState(false);
    const handleBackdropReady = useCallback(() => setVideoReady(true), []);
    const handleYouTubeEngaged = useCallback(() => setYoutubeEngaged(true), []);

    return (
        <div
            className={`relative transition-colors duration-500 ${
                videoReady ? "min-[600px]:text-white dark:min-[600px]:text-white" : ""
            }`}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden min-[600px]:block"
            >
                <HeroBackdropVideo
                    onReady={handleBackdropReady}
                    onYouTubeEngaged={handleYouTubeEngaged}
                />
                <div
                    className={`absolute inset-0 transition-colors duration-700 ${
                        youtubeEngaged
                            ? "bg-black/5 dark:bg-black/10"
                            : "bg-[#C2E6EC]/10 dark:bg-[hsl(224,48%,9%)]/45"
                    }`}
                />
                <div
                    className={`absolute inset-0 transition-opacity duration-1000 ${
                        youtubeEngaged ? "opacity-100" : "opacity-0"
                    }`}
                    style={{
                        background:
                            "radial-gradient(circle at center, transparent 0%, transparent 46%, rgba(0, 0, 0, 0.58) 100%)",
                    }}
                />
                <div className="absolute inset-x-0 top-0 hidden h-32 bg-gradient-to-b to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                <div className="absolute inset-x-0 bottom-0 hidden h-32 bg-gradient-to-t to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                <div className="absolute inset-y-0 left-0 hidden w-32 bg-gradient-to-r to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                <div className="absolute inset-y-0 right-0 hidden w-32 bg-gradient-to-l to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
            </div>
            <div
                className={`relative z-10 transition-opacity duration-700 ease-out ${
                    youtubeEngaged
                        ? "min-[600px]:opacity-[0.5] min-[600px]:hover:opacity-100 min-[600px]:focus-within:opacity-100"
                        : ""
                }`}
            >
                {children}
            </div>
        </div>
    );
}
