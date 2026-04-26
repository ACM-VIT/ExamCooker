"use client";

import { useEffect, useState } from "react";

const VIDEOS = ["/night.webm", "/rainy.webm"] as const;

export default function HeroBackdropVideo() {
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
            className="absolute inset-0 h-full w-full object-cover"
        >
            <source src={src} type="video/webm" />
        </video>
    );
}
