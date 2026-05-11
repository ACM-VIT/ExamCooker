"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ReactPlayer from "react-player";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";

const PixelBlast = dynamic(() => import("./pixel-bg"), { ssr: false });
export type HeroBackdropKind = "local" | "youtube" | "pixel";

const VIDEOS = [
    { kind: "local", webm: "/rainy.webm", mp4: "/rainy.mp4", poster: "/rainy.jpg" },
    { kind: "local", webm: "/midnight.webm", mp4: "/midnight.mp4", poster: "/midnight.jpg" },
    { kind: "local", webm: "/night.webm", mp4: "/night.mp4", poster: "/night.jpg" },
    { kind: "local", webm: "/night-city.webm", mp4: "/night-city.mp4", poster: "/night-city.jpg" },
    { kind: "pixel" },
    // {
    //     kind: "youtube",
    //     id: "AUQKjgKQF7w",
    //     url: "https://www.youtube.com/watch?v=AUQKjgKQF7w",
    // },
] as const;
const TABLET_MIN_WIDTH_MEDIA = "(min-width: 600px)";

interface Props {
    onReady?: () => void;
    onYouTubeEngaged?: () => void;
    onVariantChange?: (kind: HeroBackdropKind | null) => void;
}

export default function HeroBackdropVideo({ onReady, onYouTubeEngaged, onVariantChange }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [video, setVideo] = useState<(typeof VIDEOS)[number] | null>(null);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [isYouTubeReady, setIsYouTubeReady] = useState(false);
    // const isYouTubeEngaged = video?.kind === "youtube" && hasInteracted && isYouTubeReady;
    const isYouTubeEngaged = false;
    const notifyReady = useEffectEvent(() => {
        onReady?.();
    });
    const notifyYouTubeEngaged = useEffectEvent(() => {
        onYouTubeEngaged?.();
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

    useEffect(() => {
        if (hasInteracted) return;

        const handleInteraction = () => setHasInteracted(true);
        const options = { once: true, passive: true };

        window.addEventListener("pointerdown", handleInteraction, options);
        window.addEventListener("keydown", handleInteraction, { once: true });
        window.addEventListener("touchstart", handleInteraction, options);

        return () => {
            window.removeEventListener("pointerdown", handleInteraction);
            window.removeEventListener("keydown", handleInteraction);
            window.removeEventListener("touchstart", handleInteraction);
        };
    }, [hasInteracted]);

    useEffect(() => {
        if (!isYouTubeEngaged) return;
        notifyYouTubeEngaged();
    }, [isYouTubeEngaged]);

    useEffect(() => {
        notifyVariantChange(video?.kind ?? null);
    }, [video]);

    useEffect(() => {
        if (video?.kind !== "pixel") return;
        notifyReady();
    }, [video]);

    const handleYouTubeReady = () => {
        setIsYouTubeReady(true);
        onReady?.();
    };

    if (!video) return <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />;

    // if (video.kind === "youtube") {
    //     return (
    //         <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-black" aria-hidden="true">
    //             <div
    //                 className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[filter,transform] duration-1000 ease-out will-change-transform ${
    //                     isYouTubeEngaged
    //                         ? "scale-[1.04] brightness-[1.1] contrast-[1.08] saturate-[1.15]"
    //                         : "scale-100 brightness-[0.9] saturate-[0.9]"
    //                 }`}
    //                 style={{
    //                     width: "max(100%, 177.777778vh)",
    //                     height: "max(100%, 56.25vw)",
    //                 }}
    //             >
    //                 <ReactPlayer
    //                     url={video.url}
    //                     playing
    //                     loop
    //                     muted={!hasInteracted || !isYouTubeReady}
    //                     controls={false}
    //                     playsinline
    //                     width="100%"
    //                     height="100%"
    //                     onReady={handleYouTubeReady}
    //                     config={{
    //                         youtube: {
    //                             playerVars: {
    //                                 autoplay: 1,
    //                                 controls: 0,
    //                                 disablekb: 1,
    //                                 fs: 0,
    //                                 iv_load_policy: 3,
    //                                 loop: 1,
    //                                 modestbranding: 1,
    //                                 playsinline: 1,
    //                                 playlist: video.id,
    //                                 rel: 0,
    //                             },
    //                         },
    //                     }}
    //                 />
    //             </div>
    //         </div>
    //     );
    // }

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
