"use client";

import { useEffect, useState } from "react";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";

const VIDEOS = ["/rainy.webm", "/midnight.webm", "/night.webm", "/night-city.webm"] as const;

interface Props {
    onReady?: () => void;
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
        const cleanup = scheduleIdleWork(
            () => {
                if (cancelled) return;
                setSrc(VIDEOS[Math.floor(Math.random() * VIDEOS.length)]);
            },
            { fallbackDelayMs: 1800, timeoutMs: 2500 },
        );

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
