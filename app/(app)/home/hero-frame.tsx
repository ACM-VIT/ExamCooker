"use client";

import { ReactNode, useCallback, useState } from "react";
import HeroBackdropVideo, { type HeroBackdropKind } from "./hero-backdrop-video";

export default function HeroFrame({ children }: { children: ReactNode }) {
    const [videoReady, setVideoReady] = useState(false);
    const [backdropKind, setBackdropKind] = useState<HeroBackdropKind | null>(null);
    const handleBackdropReady = useCallback(() => setVideoReady(true), []);
    const isPixelBackdrop = backdropKind === "pixel";
    // A backdrop that failed after reporting ready no longer sits behind the text.
    const hasVideoBackdrop = videoReady && backdropKind !== null && !isPixelBackdrop;

    return (
        <div
            data-hero-backdrop={backdropKind ?? undefined}
            className={`relative transition-colors duration-500 ${
                hasVideoBackdrop ? "min-[600px]:text-white dark:min-[600px]:text-white" : ""
            }`}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden min-[600px]:block"
            >
                <HeroBackdropVideo
                    onReady={handleBackdropReady}
                    onVariantChange={setBackdropKind}
                />
                <div className="absolute inset-0 bg-[#C2E6EC]/10 transition-colors duration-700 dark:bg-[hsl(224,48%,9%)]/45" />
                <div className="absolute inset-x-0 top-0 hidden h-32 bg-gradient-to-b to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                <div className="absolute inset-x-0 bottom-0 hidden h-32 bg-gradient-to-t to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                <div className="absolute inset-y-0 left-0 hidden w-32 bg-gradient-to-r to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                <div className="absolute inset-y-0 right-0 hidden w-32 bg-gradient-to-l to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
            </div>
            <div className="relative z-10 transition-opacity duration-700 ease-out">
                {children}
            </div>
        </div>
    );
}
