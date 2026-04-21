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
        cta: "bg-[#3BF4C7] text-black",
        ctaDark: "dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:text-[#3BF4C7] dark:hover:border-[#3BF4C7]",
        eyebrow: "text-black/60 dark:text-[#3BF4C7]/80",
    },
    blue: {
        cta: "bg-[#5FC4E7] text-black",
        ctaDark: "dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:text-[#5FC4E7] dark:hover:border-[#5FC4E7]",
        eyebrow: "text-black/60 dark:text-[#5FC4E7]/80",
    },
    peach: {
        cta: "bg-[#FFB38A] text-black",
        ctaDark: "dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:text-[#FFB38A] dark:hover:border-[#FFB38A]",
        eyebrow: "text-black/60 dark:text-[#FFB38A]/80",
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
                className={`pointer-events-auto relative w-full max-w-[22rem] border-2 border-black bg-white text-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all ease-out dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[4px_4px_0_0_rgba(59,244,199,0.35)] sm:max-w-sm ${
                    visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                }`}
                style={{ transitionDuration: `${ENTER_MS}ms` }}
            >
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Dismiss"
                    className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center text-black/50 transition-colors hover:text-black dark:text-[#D5D5D5]/60 dark:hover:text-[#3BF4C7]"
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
                            className={`text-[10px] font-bold uppercase tracking-[0.12em] sm:text-[11px] ${styles.eyebrow}`}
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
                    <a
                        href={upsell.cta.href}
                        target={upsell.cta.external ? "_blank" : undefined}
                        rel={upsell.cta.external ? "noopener noreferrer" : undefined}
                        onClick={handleCtaClick}
                        className={`mt-3 inline-flex h-9 w-full items-center justify-center border-2 border-black text-sm font-bold transition duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 dark:border-[#D5D5D5] sm:mt-4 sm:h-10 ${styles.cta} ${styles.ctaDark}`}
                    >
                        {upsell.cta.label}
                    </a>
                </div>
            </div>
        </div>
    );
};

export default UpsellToast;
