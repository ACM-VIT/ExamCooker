"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";

const PixelBlast = dynamic(() => import("./pixel-bg"), { ssr: false });
export type HeroBackdropKind = "local" | "pixel";

type LocalHeroVideo = {
    kind: "local";
    webm?: string;
    mp4: string;
    poster?: string;
    /** Play the intro once, then loop from this timestamp instead of 0. */
    loopStart?: number;
};
type PixelHeroVideo = { kind: "pixel" };
type HeroVideo = LocalHeroVideo | PixelHeroVideo;

const VIDEOS = [
    { kind: "local", webm: "/rainy.webm", mp4: "/rainy.mp4", poster: "/rainy.jpg" },
    { kind: "local", webm: "/midnight.webm", mp4: "/midnight.mp4", poster: "/midnight.jpg" },
    { kind: "local", webm: "/night.webm", mp4: "/night.mp4", poster: "/night.jpg" },
    { kind: "local", webm: "/night-city.webm", mp4: "/night-city.mp4", poster: "/night-city.jpg" },
    { kind: "local", mp4: "/claude-hero.mp4" },
    { kind: "local", webm: "/shark.webm", mp4: "/shark.mp4", poster: "/shark.jpg", loopStart: 14.5 },
    { kind: "pixel" },
] satisfies readonly HeroVideo[];
const TABLET_MIN_WIDTH_MEDIA = "(min-width: 600px)";

// "waiting" until the hero is near the viewport and the browser is idle;
// "skipped" when the device should not play a backdrop; "failed" when the
// chosen video could not load, so the plain hero stays.
type BackdropState =
    | { status: "waiting" }
    | { status: "skipped" }
    | { status: "showing"; video: HeroVideo }
    | { status: "failed" };

interface Props {
    onReady?: () => void;
    onVariantChange?: (kind: HeroBackdropKind | null) => void;
}

export default function HeroBackdropVideo({ onReady, onVariantChange }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [backdrop, setBackdrop] = useState<BackdropState>({ status: "waiting" });
    const video = backdrop.status === "showing" ? backdrop.video : null;
    const notifyReady = useEffectEvent(() => {
        onReady?.();
    });
    const notifyVariantChange = useEffectEvent((kind: HeroBackdropKind | null) => {
        onVariantChange?.(kind);
    });

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

        const connection = (navigator as Navigator & {
            connection?: { saveData?: boolean; effectiveType?: string };
        }).connection;
        if (
            !window.matchMedia(TABLET_MIN_WIDTH_MEDIA).matches ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
            connection?.saveData ||
            connection?.effectiveType === "2g"
        ) {
            setBackdrop({ status: "skipped" });
            return;
        }

        let cancelled = false;
        const cleanup = scheduleIdleWork(
            () => {
                if (cancelled) return;
                setBackdrop({
                    status: "showing",
                    video: VIDEOS[Math.floor(Math.random() * VIDEOS.length)],
                });
            },
            { fallbackDelayMs: 1800, timeoutMs: 2500 },
        );

        return () => {
            cancelled = true;
            cleanup();
        };
    }, [isVisible]);

    useEffect(() => {
        notifyVariantChange(video?.kind ?? null);
    }, [video]);

    useEffect(() => {
        if (video?.kind !== "pixel") return;
        notifyReady();
    }, [video]);

    if (!video) return <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />;

    if (video.kind === "pixel") {
        return (
            <div
                ref={containerRef}
                className="absolute inset-0 overflow-hidden"
                aria-hidden="true"
            >
                <div className="relative h-full w-full">
                    <PixelBlast
                        variant="square"
                        pixelSize={4}
                        color="#B497CF"
                        patternScale={2}
                        patternDensity={1}
                        pixelSizeJitter={0}
                        enableRipples
                        rippleSpeed={0.4}
                        rippleThickness={0.12}
                        rippleIntensityScale={1.5}
                        liquid={false}
                        liquidStrength={0.12}
                        liquidRadius={1.2}
                        liquidWobbleSpeed={5}
                        speed={0.5}
                        edgeFade={0.25}
                        transparent
                    />
                </div>
            </div>
        );
    }

    const sources = [
        video.webm ? { src: video.webm, type: "video/webm" } : null,
        { src: video.mp4, type: "video/mp4" },
    ];

    const loopStart = video.loopStart;

    return (
        <div ref={containerRef} className="absolute inset-0" aria-hidden="true">
            <video
                autoPlay
                loop={loopStart === undefined}
                muted
                playsInline
                preload="metadata"
                poster={video.poster}
                disablePictureInPicture
                disableRemotePlayback
                onCanPlay={onReady}
                onEnded={
                    loopStart === undefined
                        ? undefined
                        : (event) => {
                              const element = event.currentTarget;
                              element.currentTime = loopStart;
                              void element.play().catch(() => {});
                          }
                }
                className="h-full w-full object-cover"
            >
                {/* With <source> children the video reports no error of its own;
                    the last source failing means every source failed. */}
                {sources.map((source, index) =>
                    source ? (
                        <source
                            key={source.src}
                            src={source.src}
                            type={source.type}
                            onError={
                                index === sources.length - 1
                                    ? () => setBackdrop({ status: "failed" })
                                    : undefined
                            }
                        />
                    ) : null,
                )}
            </video>
        </div>
    );
}
