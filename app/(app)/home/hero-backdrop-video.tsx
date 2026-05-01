"use client";

import { useEffect, useState } from "react";

const VIDEOS = ["/night.webm", "/rainy.webm", "/midnight.webm", "/night-city.webm"] as const;

interface Props {
    onReady?: () => void;
}

export default function HeroBackdropVideo({ onReady }: Props) {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!window.matchMedia("(min-width: 768px)").matches) return;
        setSrc(VIDEOS[Math.floor(Math.random() * VIDEOS.length)]);
    }, []);

    if (!src) return null;

    return (
        <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            onCanPlay={onReady}
            className="absolute inset-0 h-full w-full object-cover"
        >
            <source src={src} type="video/webm" />
        </video>
    );
}
