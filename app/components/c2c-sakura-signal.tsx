"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./c2c-sakura-signal.module.css";

const EVENT_URL =
    "https://gravitas.vit.ac.in/events/0eba5a6f-2687-416c-acd7-c51419433366";
const BANNER_DISMISSED_KEY = "examcooker:c2c-sakura-banner-dismissed";

type PetalStyle = React.CSSProperties & {
    "--petal-x": string;
    "--petal-y": string;
    "--petal-size": string;
    "--petal-delay": string;
    "--petal-duration": string;
    "--petal-rotation": string;
};

const driftingPetals = [
    { x: 4, y: 5, size: 12, delay: -2, duration: 11, rotation: 18 },
    { x: 19, y: 14, size: 9, delay: -7, duration: 14, rotation: 72 },
    { x: 34, y: 4, size: 14, delay: -4, duration: 13, rotation: 136 },
    { x: 48, y: 19, size: 8, delay: -10, duration: 16, rotation: 204 },
    { x: 61, y: 9, size: 11, delay: -1, duration: 12, rotation: 282 },
    { x: 72, y: 23, size: 8, delay: -6, duration: 15, rotation: 330 },
    { x: 83, y: 12, size: 13, delay: -9, duration: 14, rotation: 42 },
    { x: 91, y: 29, size: 9, delay: -3, duration: 13, rotation: 112 },
];

const sidePetals = [
    { x: 20, y: 4, size: 10, delay: -4, duration: 15, rotation: 36 },
    { x: 57, y: 17, size: 7, delay: -12, duration: 17, rotation: 118 },
    { x: 14, y: 34, size: 12, delay: -7, duration: 19, rotation: 188 },
    { x: 61, y: 51, size: 8, delay: -2, duration: 16, rotation: 260 },
    { x: 23, y: 69, size: 10, delay: -10, duration: 18, rotation: 316 },
    { x: 55, y: 87, size: 7, delay: -6, duration: 14, rotation: 76 },
];

function Blossom({ className = "" }: { className?: string }) {
    return (
        <span className={`${styles.blossom} ${className}`}>
            <i />
            <i />
            <i />
            <i />
            <i />
        </span>
    );
}

function Petal({
    x,
    y,
    size,
    delay,
    duration,
    rotation,
    side = false,
}: (typeof driftingPetals)[number] & { side?: boolean }) {
    const style: PetalStyle = {
        "--petal-x": `${x}%`,
        "--petal-y": `${y}%`,
        "--petal-size": `${size}px`,
        "--petal-delay": `${delay}s`,
        "--petal-duration": `${duration}s`,
        "--petal-rotation": `${rotation}deg`,
    };

    return (
        <span
            className={`${styles.petal} ${side ? styles.sidePetal : ""}`}
            style={style}
        />
    );
}

function MarqueeMessage() {
    return (
        <span className={styles.marqueeMessage}>
            <span className={styles.marqueeFlower} aria-hidden="true">
                <Blossom />
            </span>
            <strong>Code2Create 7.0</strong>
            <span className={styles.marqueeDivider} aria-hidden="true" />
            <span>48 hours to turn “what if?” into “what’s next.”</span>
            <span className={styles.marqueeDate}>Starts 04 Sep 2026</span>
            <span className={styles.marqueeCta}>Explore the hackathon&nbsp; →</span>
        </span>
    );
}

export default function C2CSakuraSignal() {
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const panelCloseRef = useRef<HTMLButtonElement>(null);
    const panelTriggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        try {
            setBannerDismissed(
                window.localStorage.getItem(BANNER_DISMISSED_KEY) === "true",
            );
        } catch {
            // Storage can be unavailable in private or restricted browser contexts.
        }
    }, []);

    useEffect(() => {
        if (!panelOpen) return;

        panelCloseRef.current?.focus();
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setPanelOpen(false);
            window.requestAnimationFrame(() => panelTriggerRef.current?.focus());
        };

        document.addEventListener("keydown", closeOnEscape);
        return () => document.removeEventListener("keydown", closeOnEscape);
    }, [panelOpen]);

    const dismissBanner = () => {
        setBannerDismissed(true);
        try {
            window.localStorage.setItem(BANNER_DISMISSED_KEY, "true");
        } catch {
            // The banner still dismisses for the current session without storage.
        }
    };

    const closePanel = () => {
        setPanelOpen(false);
        window.requestAnimationFrame(() => panelTriggerRef.current?.focus());
    };

    return (
        <div
            className={`${styles.root} ${bannerDismissed ? styles.bannerIsDismissed : ""}`}
        >
            {!bannerDismissed ? (
                <aside className={styles.banner} aria-label="Code2Create announcement">
                    <a className={styles.marqueeLink} href={EVENT_URL}>
                        <span className={styles.srOnly}>
                            Code2Create 7.0 is ACM-VIT&apos;s 48-hour national
                            hackathon, starting 4 September 2026. View event details.
                        </span>
                        <span className={styles.marqueeViewport} aria-hidden="true">
                            <span className={styles.marqueeTrack}>
                                <MarqueeMessage />
                                <MarqueeMessage />
                            </span>
                        </span>
                    </a>
                    <button
                        type="button"
                        className={styles.bannerClose}
                        onClick={dismissBanner}
                        aria-label="Dismiss Code2Create announcement"
                    >
                        <span aria-hidden="true" />
                    </button>
                </aside>
            ) : null}

            <div className={styles.petalScene} aria-hidden="true">
                <div className={styles.signalBloom}>
                    <span className={`${styles.signalArc} ${styles.signalArcOuter}`} />
                    <span className={`${styles.signalArc} ${styles.signalArcInner}`} />
                    <span className={styles.signalSpark} />
                    <Blossom className={styles.blossomOne} />
                    <Blossom className={styles.blossomTwo} />
                    <Blossom className={styles.blossomThree} />
                    <div className={styles.driftField}>
                        {driftingPetals.map((petal, index) => (
                            <Petal key={index} {...petal} />
                        ))}
                    </div>
                </div>
                <div className={styles.sideTrail}>
                    <span className={styles.trailLine} />
                    {sidePetals.map((petal, index) => (
                        <Petal key={index} {...petal} side />
                    ))}
                </div>
            </div>

            <button
                ref={panelTriggerRef}
                type="button"
                className={styles.whyButton}
                aria-expanded={panelOpen}
                aria-controls="c2c-sakura-panel"
                onClick={() => setPanelOpen((open) => !open)}
            >
                <span className={styles.whyDot} aria-hidden="true" />
                <span>Why the petals?</span>
            </button>

            <section
                id="c2c-sakura-panel"
                className={`${styles.infoPanel} ${panelOpen ? styles.infoPanelOpen : ""}`}
                aria-labelledby="c2c-sakura-panel-title"
                aria-hidden={!panelOpen}
                inert={!panelOpen ? true : undefined}
            >
                <div className={styles.panelGlow} aria-hidden="true" />
                <div className={styles.panelHeader}>
                    <div>
                        <p className={styles.eyebrow}>Sakura signal · C2C 7.0</p>
                        <h2 id="c2c-sakura-panel-title">A bloom for bold ideas.</h2>
                    </div>
                    <button
                        ref={panelCloseRef}
                        type="button"
                        className={styles.panelClose}
                        onClick={closePanel}
                        aria-label="Close Code2Create information"
                    >
                        <span aria-hidden="true" />
                    </button>
                </div>
                <p className={styles.panelCopy}>
                    Code2Create 7.0 is ACM-VIT&apos;s flagship 48-hour national
                    hackathon—built for the ideas that deserve room to grow.
                </p>
                <div className={styles.eventDetails}>
                    <span>
                        <small>Begins</small>
                        04 Sep 2026
                    </span>
                    <span>
                        <small>Format</small>
                        48 hours
                    </span>
                </div>
                <p className={styles.tagline}>
                    Turning <em>what if?</em> into <em>what&apos;s next.</em>
                </p>
                <a className={styles.panelCta} href={EVENT_URL}>
                    See Code2Create
                    <span aria-hidden="true">↗</span>
                </a>
            </section>
        </div>
    );
}
