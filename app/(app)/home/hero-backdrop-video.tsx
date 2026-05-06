"use client";

import { useEffect, useRef, useState } from "react";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";

const VIDEOS = [
    { webm: "/rainy.webm", mp4: "/rainy.mp4", poster: "/rainy.jpg" },
    { webm: "/midnight.webm", mp4: "/midnight.mp4", poster: "/midnight.jpg" },
    { webm: "/night.webm", mp4: "/night.mp4", poster: "/night.jpg" },
    { webm: "/night-city.webm", mp4: "/night-city.mp4", poster: "/night-city.jpg" },
] as const;
const TABLET_MIN_WIDTH_MEDIA = "(min-width: 600px)";

interface Props {
    onReady?: () => void;
}

export default function HeroBackdropVideo({ onReady }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [video, setVideo] = useState<(typeof VIDEOS)[number] | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry?.isIntersecting) return;
                setIsVisible(true);
                observer.disconnect();
            },
            { rootMargin: "200px 0px" },
        );

        observer.observe(container);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        if (typeof window === "undefined") return;
        if (!window.matchMedia(TABLET_MIN_WIDTH_MEDIA).matches) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const connection = (navigator as Navigator & {
            connection?: { saveData?: boolean; effectiveType?: string };
        }).connection;
        if (connection?.saveData || connection?.effectiveType === "2g") return;

        let cancelled = false;
        const cleanup = scheduleIdleWork(
            () => {
                if (cancelled) return;
                setVideo(VIDEOS[Math.floor(Math.random() * VIDEOS.length)]);
            },
            { fallbackDelayMs: 1800, timeoutMs: 2500 },
        );

        return () => {
            cancelled = true;
            cleanup();
        };
    }, [isVisible]);

    if (!video) return <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />;

    return (
        <div ref={containerRef} className="absolute inset-0" aria-hidden="true">
            <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                poster={video.poster}
                disablePictureInPicture
                disableRemotePlayback
                onCanPlay={onReady}
                className="h-full w-full object-cover"
            >
                <source src={video.webm} type="video/webm" />
                <source src={video.mp4} type="video/mp4" />
            </video>
        </div>
    );
}
