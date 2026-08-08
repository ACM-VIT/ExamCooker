"use client";

import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import styles from "./c2c-sakura-signal.module.css";

const EVENT_URL =
    "https://gravitas.vit.ac.in/events/0eba5a6f-2687-416c-acd7-c51419433366";

const BANNER_DISMISS_KEY = "c2c7-banner-dismissed";
const DOCK_HIDE_KEY = "c2c7-dock-hidden";
// The banner shows once, on the user's first visit, then auto-retires to the
// corner dock after a minute even if they never touch it.
const BANNER_AUTO_HIDE_MS = 60_000;
// Pointer travel before a press turns into a drag instead of a click.
const DRAG_START_THRESHOLD_PX = 6;
// How close the dock's centre must be to the X to arm/drop into it.
const DISMISS_SNAP_RADIUS_PX = 72;
// Distance from the viewport bottom to the X's centre (matches the CSS
// `bottom: 2.5rem` + half the 3.75rem target).
const DISMISS_TARGET_BOTTOM_CENTER_PX = 70;

type PetalStyle = React.CSSProperties & {
    "--petal-left": string;
    "--petal-size": string;
    "--petal-delay": string;
    "--petal-duration": string;
    "--petal-rotation": string;
    "--petal-drift": string;
    "--petal-end-drift": string;
};

const fallingPetals = [
    { left: 10, size: 7, delay: -4, duration: 18, rotation: 24, drift: 18 },
    { left: 27, size: 8, delay: -11, duration: 19, rotation: 118, drift: -22 },
    { left: 40, size: 7, delay: -6, duration: 16, rotation: 210, drift: 16 },
    { left: 50, size: 9, delay: -15, duration: 21, rotation: 304, drift: -20 },
    { left: 58, size: 11, delay: -8, duration: 18, rotation: 56, drift: 25 },
    { left: 63, size: 8, delay: -1, duration: 16, rotation: 168, drift: -18 },
    { left: 67, size: 10, delay: -13, duration: 20, rotation: 242, drift: 22 },
    { left: 70, size: 7, delay: -5, duration: 15, rotation: 336, drift: -16 },
    { left: 73, size: 9, delay: -17, duration: 22, rotation: 82, drift: 24 },
    { left: 76, size: 12, delay: -9, duration: 17, rotation: 154, drift: -26 },
    { left: 78, size: 7, delay: -2, duration: 15, rotation: 268, drift: 18 },
    { left: 80, size: 10, delay: -14, duration: 21, rotation: 18, drift: -23 },
    { left: 82, size: 12, delay: -7, duration: 19, rotation: 126, drift: 27 },
    { left: 84, size: 8, delay: -19, duration: 23, rotation: 220, drift: -17 },
    { left: 86, size: 11, delay: -4, duration: 16, rotation: 312, drift: 21 },
    { left: 88, size: 7, delay: -12, duration: 18, rotation: 44, drift: -25 },
    { left: 89.5, size: 9, delay: -16, duration: 22, rotation: 176, drift: 17 },
    { left: 91, size: 12, delay: -6, duration: 17, rotation: 258, drift: -22 },
    { left: 92.5, size: 8, delay: -10, duration: 20, rotation: 348, drift: 24 },
    { left: 94, size: 10, delay: -1, duration: 15, rotation: 92, drift: -19 },
    { left: 95, size: 7, delay: -18, duration: 24, rotation: 196, drift: 16 },
    { left: 96, size: 8, delay: -20, duration: 25, rotation: 288, drift: -17 },
    { left: 97, size: 9, delay: -21, duration: 23, rotation: 32, drift: 19 },
    { left: 98, size: 7, delay: -22, duration: 24, rotation: 142, drift: -18 },
    { left: 99, size: 8, delay: -23, duration: 22, rotation: 236, drift: 16 },
] as const;

const bannerPetals = [
    { start: 4, top: 18, size: 6, delay: 0, duration: 13, spin: 40 },
    { start: 22, top: 58, size: 5, delay: -4, duration: 16, spin: 160 },
    { start: 43, top: 30, size: 7, delay: -8, duration: 14, spin: 260 },
    { start: 62, top: 62, size: 5, delay: -2, duration: 17, spin: 80 },
    { start: 78, top: 24, size: 6, delay: -11, duration: 15, spin: 200 },
    { start: 90, top: 52, size: 5, delay: -6, duration: 18, spin: 320 },
] as const;

function Petal({
    left,
    size,
    delay,
    duration,
    rotation,
    drift,
}: (typeof fallingPetals)[number]) {
    const style: PetalStyle = {
        "--petal-left": `${left}%`,
        "--petal-size": `${size}px`,
        "--petal-delay": `${delay}s`,
        "--petal-duration": `${duration}s`,
        "--petal-rotation": `${rotation}deg`,
        "--petal-drift": `${drift}px`,
        "--petal-end-drift": `${Math.round(drift * -0.58)}px`,
    };

    return <span className={styles.petal} style={style} />;
}

export default function C2CSakuraSignal() {
    const [isPointerActive, setIsPointerActive] = useState(false);
    // "banner" until dismissed once, then the corner dock forever after.
    // "hidden" when the dock was dragged into the dismiss target this session.
    // Starts as null so the server render carries no promo markup at all.
    const [surface, setSurface] = useState<
        "banner" | "dock" | "hidden" | null
    >(null);
    // Non-null while the dock is being dragged; offset is relative to the
    // dock's resting spot in the corner.
    const [dragOffset, setDragOffset] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [isOverDismiss, setIsOverDismiss] = useState(false);
    const dragStartRef = useRef<{
        pointerX: number;
        pointerY: number;
        dockCenterX: number;
        dockCenterY: number;
    } | null>(null);
    const didDragRef = useRef(false);
    // Mirrors of the drag state for the pointer-up handler: a fast flick can
    // deliver its final move and the release in the same tick, before React
    // has re-rendered, so the handler must not rely on state closures.
    const dragActiveRef = useRef(false);
    const overDismissRef = useRef(false);

    useEffect(() => {
        try {
            if (window.sessionStorage.getItem(DOCK_HIDE_KEY)) {
                setSurface("hidden");
                return;
            }
        } catch {
            // Storage unavailable: fall through to the banner/dock choice.
        }
        try {
            if (window.localStorage.getItem(BANNER_DISMISS_KEY)) {
                setSurface("dock");
            } else {
                // Seen means spent: the banner never shows a second time,
                // whether or not the user closes it themselves.
                window.localStorage.setItem(BANNER_DISMISS_KEY, "1");
                setSurface("banner");
            }
        } catch {
            setSurface("dock");
        }
    }, []);

    const dismissBanner = () => {
        setSurface("dock");
    };

    useEffect(() => {
        if (surface !== "banner") return;
        const timeoutId = window.setTimeout(
            () => setSurface("dock"),
            BANNER_AUTO_HIDE_MS,
        );
        return () => window.clearTimeout(timeoutId);
    }, [surface]);

    const dismissTargetCenter = () => ({
        x: window.innerWidth / 2,
        y: window.innerHeight - DISMISS_TARGET_BOTTOM_CENTER_PX,
    });

    const handleDockPointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        dragStartRef.current = {
            pointerX: e.clientX,
            pointerY: e.clientY,
            dockCenterX: rect.left + rect.width / 2,
            dockCenterY: rect.top + rect.height / 2,
        };
        // Capture up-front so fast drags keep sending moves to the dock even
        // once the pointer has left its small hit area.
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handleDockPointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
        const start = dragStartRef.current;
        if (!start) return;
        const dx = e.clientX - start.pointerX;
        const dy = e.clientY - start.pointerY;
        if (!dragActiveRef.current) {
            if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return;
            didDragRef.current = true;
            dragActiveRef.current = true;
            setIsPointerActive(false);
        }
        setDragOffset({ x: dx, y: dy });
        const target = dismissTargetCenter();
        const overDismiss =
            Math.hypot(
                start.dockCenterX + dx - target.x,
                start.dockCenterY + dy - target.y,
            ) < DISMISS_SNAP_RADIUS_PX;
        overDismissRef.current = overDismiss;
        setIsOverDismiss(overDismiss);
    };

    const handleDockPointerEnd = () => {
        const droppedOnDismiss = dragActiveRef.current && overDismissRef.current;
        dragStartRef.current = null;
        dragActiveRef.current = false;
        overDismissRef.current = false;
        setDragOffset(null);
        setIsOverDismiss(false);
        if (droppedOnDismiss) {
            try {
                window.sessionStorage.setItem(DOCK_HIDE_KEY, "1");
            } catch {
                // Storage unavailable: still hide for this page's lifetime.
            }
            setSurface("hidden");
        }
    };

    const handleDockClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // A drag gesture must not also open the event link.
        if (didDragRef.current) {
            e.preventDefault();
            didDragRef.current = false;
        }
    };

    if (surface === null || surface === "hidden") {
        return null;
    }

    if (surface === "banner") {
        return (
            <div className={styles.root}>
                <div
                    className={styles.banner}
                    role="region"
                    aria-label="Code2Create 7.0 announcement"
                >
                    <span className={styles.bannerPetalField} aria-hidden="true">
                        {bannerPetals.map((petal, index) => (
                            <span
                                key={index}
                                className={styles.bannerPetal}
                                style={
                                    {
                                        "--bp-start": `${petal.start}%`,
                                        "--bp-top": `${petal.top}%`,
                                        "--bp-size": `${petal.size}px`,
                                        "--bp-delay": `${petal.delay}s`,
                                        "--bp-duration": `${petal.duration}s`,
                                        "--bp-spin": `${petal.spin}deg`,
                                    } as React.CSSProperties
                                }
                            />
                        ))}
                    </span>
                    <a
                        className={styles.bannerLink}
                        href={EVENT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Image
                            src="/icons/c2clogo.png"
                            alt=""
                            width={22}
                            height={23}
                            className={styles.bannerLogo}
                        />
                        <strong className={styles.bannerTitle}>
                            Code2Create 7.0
                        </strong>
                        <span className={styles.bannerTagline}>
                            ACM-VIT&apos;s flagship 48-hour national hackathon
                        </span>
                        <span className={styles.bannerCta}>Register</span>
                    </a>
                    <button
                        type="button"
                        className={styles.bannerClose}
                        onClick={dismissBanner}
                        aria-label="Dismiss Code2Create announcement"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <a
                className={styles.activationDock}
                href={EVENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Code2Create 7.0 event details"
                draggable={false}
                data-pointer-active={isPointerActive ? "true" : undefined}
                data-dragging={dragOffset ? "true" : undefined}
                style={
                    dragOffset
                        ? {
                              // Starts from the hover offset so the dock does
                              // not jump when the drag takes over from hover.
                              transform: `translate(calc(${dragOffset.x}px - 0.9rem), calc(${dragOffset.y}px + 0.9rem))`,
                              transition: "none",
                          }
                        : undefined
                }
                onPointerEnter={() => setIsPointerActive(true)}
                onPointerLeave={() => setIsPointerActive(false)}
                onPointerDown={handleDockPointerDown}
                onPointerMove={handleDockPointerMove}
                onPointerUp={handleDockPointerEnd}
                onPointerCancel={handleDockPointerEnd}
                onClick={handleDockClick}
            >
                <span className={styles.bloomRing} aria-hidden="true">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                        <span
                            key={index}
                            className={styles.bloomPetal}
                            style={
                                {
                                    "--bloom-angle": `${index * 60}deg`,
                                    "--bloom-delay": `${index * 55}ms`,
                                } as React.CSSProperties
                            }
                        />
                    ))}
                </span>
                <span className={styles.logoFrame} aria-hidden="true">
                    <Image
                        src="/icons/c2clogo.png"
                        alt=""
                        width={92}
                        height={95}
                        className={styles.logoImage}
                        draggable={false}
                        priority
                    />
                </span>
                <span className={styles.revealStack}>
                    <span className={styles.revealLabel}>Code2Create 7.0</span>
                    <span className={styles.revealDescription}>
                        ACM-VIT&apos;s flagship 48-hour national hackathon.
                    </span>
                </span>
            </a>

            <div className={styles.petalRain} aria-hidden="true">
                {fallingPetals.map((petal, index) => (
                    <Petal key={index} {...petal} />
                ))}
            </div>

            {dragOffset !== null && (
                <div
                    className={styles.dismissTarget}
                    data-armed={isOverDismiss ? "true" : undefined}
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                    >
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </div>
            )}
        </div>
    );
}
