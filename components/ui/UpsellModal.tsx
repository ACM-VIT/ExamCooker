"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GradientText } from "@/app/components/landing_page/landing";

const MODAL_STORAGE_KEY = "examcooker.upsellModal.v1";
const MODAL_SHOW_DELAY_MS = 2400;

function hasSeenModal(): boolean {
    if (typeof window === "undefined") return true;
    try {
        return window.localStorage.getItem(MODAL_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function markModalSeen() {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(MODAL_STORAGE_KEY, "1");
    } catch {
        /* fail silently */
    }
}

const FEATURES = [
    {
        title: "Resource Repository",
        desc: "Video lectures, key takeaways, and practice sets, all organized by module and topic.",
    },
    {
        title: "Smarter Navigation",
        desc: "We reworked search, filters, and course maps so you can actually find what you're looking for.",
    },
    {
        title: "Polished Interface",
        desc: "Everything feels snappier and cleaner. We've been sweating the small stuff.",
    },
];

const UpsellModal = () => {
    const [phase, setPhase] = useState<"idle" | "entering" | "open" | "leaving" | "closed">("idle");

    useEffect(() => {
        if (hasSeenModal()) {
            setPhase("closed");
            return;
        }
        const timer = window.setTimeout(() => setPhase("entering"), MODAL_SHOW_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (phase === "entering") {
            const raf = requestAnimationFrame(() => {
                requestAnimationFrame(() => setPhase("open"));
            });
            return () => cancelAnimationFrame(raf);
        }
    }, [phase]);

    const handleDismiss = useCallback(() => {
        markModalSeen();
        setPhase("leaving");
        window.setTimeout(() => setPhase("closed"), 320);
    }, []);

    const isVisible = phase === "open";
    const isRendered = phase !== "idle" && phase !== "closed";

    if (!isRendered) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Introducing the refreshed ExamCooker"
            className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6"
        >
            <div
                onClick={handleDismiss}
                aria-hidden="true"
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                style={{ opacity: isVisible ? 1 : 0 }}
            />

            <div
                className="relative w-full max-w-[26rem] overflow-hidden bg-white dark:bg-[#0C1222] sm:max-w-[28rem]"
                style={{
                    transitionProperty: "transform, opacity",
                    transitionDuration: "320ms",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transform: isVisible ? "scale(1) translateY(0)" : "scale(0.95) translateY(16px)",
                    opacity: isVisible ? 1 : 0,
                }}
            >
                <div className="relative h-44 overflow-hidden sm:h-52">
                    <Image
                        src="/upsell1.png"
                        alt=""
                        fill
                        sizes="(min-width: 640px) 28rem, 26rem"
                        className="object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-[#0C1222]" />

                    <button
                        type="button"
                        onClick={handleDismiss}
                        aria-label="Close"
                        className="absolute right-2.5 top-2.5 z-10 inline-flex h-7 w-7 items-center justify-center text-white/60 transition-colors hover:text-white"
                    >
                        <svg
                            viewBox="0 0 14 14"
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        >
                            <path d="M1 1L13 13M13 1L1 13" />
                        </svg>
                    </button>
                </div>

                {/* ── CONTENT (bottom 2/3) ── */}
                <div className="px-5 pb-6 pt-0 sm:px-7 sm:pb-7">
                    {/* centered title */}
                    <div className="text-center">
                        <h2 className="text-xl font-extrabold leading-tight tracking-tight text-black dark:text-white sm:text-2xl">
                            Introducing the refreshed{" "}
                            <GradientText>ExamCooker</GradientText>
                        </h2>
                        <p className="mx-auto mt-2 max-w-[30ch] text-[13px] leading-relaxed text-black/50 dark:text-[#D5D5D5]/50 sm:text-sm">
                            We rebuilt the experience from the ground up to get you exam-ready, faster.
                        </p>
                    </div>

                    {/* features */}
                    <div className="mt-5 space-y-2.5 sm:mt-6">
                        {FEATURES.map((f) => (
                            <div
                                key={f.title}
                                className="px-3 py-3 text-center"
                            >
                                <p className="text-[13px] font-semibold tracking-tight text-black dark:text-[#D5D5D5] sm:text-sm">
                                    {f.title}
                                </p>
                                <p className="mx-auto mt-1 max-w-[30ch] text-[12px] leading-snug text-black/55 dark:text-[#D5D5D5]/50 sm:text-[13px]">
                                    {f.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="group relative mt-5 inline-flex w-full items-stretch sm:mt-6">
                        <div className="absolute inset-0 bg-black dark:bg-white/10" />
                        <div className="absolute inset-0 bg-[#3BF4C7] blur-[60px] opacity-0 transition duration-200 group-hover:opacity-20 dark:hidden" />
                        <Link
                            href="/"
                            onClick={handleDismiss}
                            className="relative inline-flex h-11 w-full items-center justify-center border-2 border-black bg-[#3BF4C7] text-sm font-bold text-black transition duration-150 group-hover:-translate-x-1 group-hover:-translate-y-1 dark:border-white/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/80 dark:group-hover:border-white/30 dark:group-hover:text-[#D5D5D5]"
                        >
                            Explore what&apos;s new
                        </Link>
                    </div>

                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="mt-3 w-full text-center text-xs font-medium text-black/35 transition-colors hover:text-black/60 dark:text-[#D5D5D5]/30 dark:hover:text-[#D5D5D5]/55"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpsellModal;
