"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    type Upsell,
    type UpsellAccent,
    UPSELL_SHOW_DELAY_MS,
    markUpsellDismissed,
    pickNextUpsell,
} from "@/lib/upsells";

const ENTER_MS = 260;

const accentStyles: Record<
    UpsellAccent,
    { cta: string; ctaDark: string; eyebrow: string }
> = {
    mint: {
        cta: "bg-[#3BF4C7] text-black hover:bg-[#3BF4C7]/85",
        ctaDark: "dark:bg-[#3BF4C7] dark:text-[#0C1222] dark:hover:bg-[#3BF4C7]/85",
        eyebrow: "text-[#1b8d6e] dark:text-[#3BF4C7]/80",
    },
    blue: {
        cta: "bg-[#5FC4E7] text-black hover:bg-[#5FC4E7]/85",
        ctaDark: "dark:bg-[#5FC4E7] dark:text-[#0C1222] dark:hover:bg-[#5FC4E7]/85",
        eyebrow: "text-[#1b6f8f] dark:text-[#5FC4E7]/80",
    },
    peach: {
        cta: "bg-[#FFB38A] text-black hover:bg-[#FFB38A]/85",
        ctaDark: "dark:bg-[#FFB38A] dark:text-[#0C1222] dark:hover:bg-[#FFB38A]/85",
        eyebrow: "text-[#a55d2d] dark:text-[#FFB38A]/80",
    },
};

const UpsellToast = () => {
    const [upsell, setUpsell] = useState<Upsell | null>(null);
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const next = pickNextUpsell();
        if (!next) return;
        const timer = window.setTimeout(() => {
            setUpsell(next);
            setMounted(true);
        }, UPSELL_SHOW_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        const raf = requestAnimationFrame(() => {
            requestAnimationFrame(() => setVisible(true));
        });
        return () => cancelAnimationFrame(raf);
    }, [mounted]);

    const accent = useMemo<UpsellAccent>(
        () => upsell?.accent ?? "mint",
        [upsell]
    );

    if (!mounted || !upsell) return null;

    const handleDismiss = () => {
        markUpsellDismissed(upsell.id);
        setVisible(false);
        window.setTimeout(() => setMounted(false), ENTER_MS);
    };

    const handleCtaClick = () => {
        markUpsellDismissed(upsell.id);
    };

    const styles = accentStyles[accent];

    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 sm:inset-x-auto sm:right-4 sm:justify-end sm:pb-4 sm:pr-0"
        >
            <div
                className={`pointer-events-auto relative w-full max-w-[22rem] border-2 border-[#5FC4E7] bg-white text-black shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] transition-all ease-out dark:border-[#ffffff]/20 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.05)] sm:max-w-sm ${
                    visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                }`}
                style={{ transitionDuration: `${ENTER_MS}ms` }}
            >
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Dismiss"
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center text-black/40 transition-colors hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/40 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                >
                    <svg
                        viewBox="0 0 14 14"
                        aria-hidden="true"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    >
                        <path d="M1 1L13 13M13 1L1 13" />
                    </svg>
                </button>
                <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
                    {upsell.eyebrow && (
                        <p
                            className={`text-[11px] font-bold sm:text-xs ${styles.eyebrow}`}
                        >
                            {upsell.eyebrow}
                        </p>
                    )}
                    <h3 className="mt-0.5 pr-7 text-[15px] font-bold leading-snug sm:mt-1 sm:text-lg">
                        {upsell.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-snug text-black/60 dark:text-[#D5D5D5]/60 sm:mt-1.5 sm:text-sm sm:leading-normal">
                        {upsell.description}
                    </p>
                    <div className="group relative mt-3 inline-flex w-full items-stretch sm:mt-4">
                        <div className="absolute inset-0 dark:bg-[#3BF4C7]" />
                        <div className="absolute inset-0 bg-[#3BF4C7] blur-[60px] opacity-0 transition duration-200 group-hover:opacity-20 dark:hidden" />
                        <div className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
                        <a
                            href={upsell.cta.href}
                            target={upsell.cta.external ? "_blank" : undefined}
                            rel={upsell.cta.external ? "noopener noreferrer" : undefined}
                            onClick={handleCtaClick}
                            className="relative inline-flex h-11 w-full items-center justify-center border-2 border-black bg-[#3BF4C7] text-sm font-bold text-black transition duration-150 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7] dark:group-hover:-translate-x-0.5 dark:group-hover:-translate-y-0.5"
                        >
                            {upsell.cta.label}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpsellToast;
