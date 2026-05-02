"use client";

import { useEffect, useState } from "react";

const VIDEOS = ["/rainy.webm", "/midnight.webm", "/night-city.webm"] as const;

interface Props {
    onReady?: () => void;
}

function scheduleIdleWork(callback: () => void) {
    if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(callback, { timeout: 2500 });
        return () => window.cancelIdleCallback(id);
    }

    const id = globalThis.setTimeout(callback, 1800);
    return () => globalThis.clearTimeout(id);
}

export default function HeroBackdropVideo({ onReady }: Props) {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!window.matchMedia("(min-width: 768px)").matches) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const connection = (navigator as Navigator & {
            connection?: { saveData?: boolean; effectiveType?: string };
        }).connection;
        if (connection?.saveData || connection?.effectiveType === "2g") return;

        let cancelled = false;
        const cleanup = scheduleIdleWork(() => {
            if (cancelled) return;
            setSrc(VIDEOS[Math.floor(Math.random() * VIDEOS.length)]);
        });

        return () => {
            cancelled = true;
            cleanup();
        };
    }, []);

    if (!src) return null;

    return (
        <video
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            disableRemotePlayback
            onCanPlay={onReady}
            className="absolute inset-0 h-full w-full object-cover"
        >
            <source src={src} type="video/webm" />
        </video>
    );
}
