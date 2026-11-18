"use client";

import React, { useCallback, useEffect, useReducer, useRef } from "react";
import { usePathname } from "next/navigation";
import {
    type Upsell,
    UPSELL_SHOW_DELAY_MS,
    markUpsellDismissed,
    pickNextUpsell,
} from "@/lib/upsells";
import { useIsMobile } from "@/app/components/ui/use-is-mobile";

const ENTER_MS = 260;
const UPSELL_AUTO_HIDE_MS = 10_000;

const ctaClassName =
    "relative inline-flex h-11 w-full cursor-pointer items-center justify-center border-2 border-black bg-[#3BF4C7] text-sm font-bold text-black transition duration-150 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7] dark:group-hover:-translate-x-0.5 dark:group-hover:-translate-y-0.5";

// hidden → entering (mounted off-screen) → visible → exiting → hidden.
type UpsellToastState =
    | { phase: "hidden" }
    | { phase: "entering" | "visible" | "exiting"; upsell: Upsell };

type UpsellToastAction =
    | { type: "mount"; upsell: Upsell }
    | { type: "show" }
    | { type: "hide" }
    | { type: "unmount"; upsellId: string }
    | { type: "reset" };

function upsellToastReducer(
    state: UpsellToastState,
    action: UpsellToastAction,
): UpsellToastState {
    switch (action.type) {
        case "mount":
            return { phase: "entering", upsell: action.upsell };
        case "show":
            return state.phase === "entering" ? { ...state, phase: "visible" } : state;
        case "hide":
            return state.phase === "entering" || state.phase === "visible"
                ? { ...state, phase: "exiting" }
                : state;
        case "unmount":
            // Only the exit that scheduled this unmount may end the toast; a
            // newer upsell mounted meanwhile stays.
            return state.phase === "exiting" && state.upsell.id === action.upsellId
                ? { phase: "hidden" }
                : state;
        case "reset":
            return state.phase === "hidden" ? state : { phase: "hidden" };
    }
}

const UpsellToast = () => {
    const pathname = usePathname();
    const isMobile = useIsMobile();
    const [toast, dispatch] = useReducer(upsellToastReducer, { phase: "hidden" });
    const upsell = toast.phase === "hidden" ? null : toast.upsell;
    const mounted = toast.phase !== "hidden";
    const visible = toast.phase === "visible";
    const upsellRef = useRef<Upsell | null>(null);
    const unmountAfterEnterRef = useRef<number | null>(null);

    upsellRef.current = upsell;

    const isUtilityPage = pathname === "/cli" || pathname.startsWith("/mod");
    const isAuthPage = pathname === "/auth";

    const clearUnmountTimer = useCallback(() => {
        if (unmountAfterEnterRef.current !== null) {
            clearTimeout(unmountAfterEnterRef.current);
            unmountAfterEnterRef.current = null;
        }
    }, []);

    const hideToast = useCallback(() => {
        const current = upsellRef.current;
        if (!current) return;
        markUpsellDismissed(current.id);
        dispatch({ type: "hide" });
        clearUnmountTimer();
        unmountAfterEnterRef.current = window.setTimeout(() => {
            unmountAfterEnterRef.current = null;
            dispatch({ type: "unmount", upsellId: current.id });
        }, ENTER_MS);
    }, [clearUnmountTimer]);

    useEffect(() => clearUnmountTimer, [clearUnmountTimer]);

    useEffect(() => {
        if (isUtilityPage || isAuthPage || isMobile) return;
        const next = pickNextUpsell();
        if (!next) return;
        const timer = window.setTimeout(() => {
            dispatch({ type: "mount", upsell: next });
        }, UPSELL_SHOW_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [isAuthPage, isUtilityPage, isMobile]);

    const entering = toast.phase === "entering";
    useEffect(() => {
        if (!entering) return;
        // Two frames so the off-screen position is painted before the transition.
        let innerRaf = 0;
        const outerRaf = requestAnimationFrame(() => {
            innerRaf = requestAnimationFrame(() => dispatch({ type: "show" }));
        });
        return () => {
            cancelAnimationFrame(outerRaf);
            cancelAnimationFrame(innerRaf);
        };
    }, [entering]);

    useEffect(() => {
        if (!isUtilityPage && !isAuthPage && !isMobile) return;
        clearUnmountTimer();
        dispatch({ type: "reset" });
    }, [clearUnmountTimer, isAuthPage, isUtilityPage, isMobile]);

    useEffect(() => {
        if (!visible || !upsell) return;
        const timer = window.setTimeout(hideToast, UPSELL_AUTO_HIDE_MS);
        return () => window.clearTimeout(timer);
    }, [visible, upsell?.id, hideToast]);

    if (isUtilityPage || isAuthPage || isMobile || !mounted || !upsell) return null;

    const handleLinkCtaClick = () => {
        markUpsellDismissed(upsell.id);
    };

    const handleCopyCta = async () => {
        try {
            await navigator.clipboard.writeText(upsell.cta.label);
        } catch {
            /* expected: permission / insecure context */
        }
        hideToast();
    };

    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-50 flex justify-center px-3 pb-3 sm:inset-x-auto sm:bottom-0 sm:right-4 sm:justify-end sm:pb-4 sm:pr-0"
        >
            <div
                className={`pointer-events-auto relative w-full max-w-[22rem] border-2 border-[#5FC4E7] bg-white text-black shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] transition-all ease-out dark:border-[#ffffff]/20 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.05)] sm:max-w-sm ${
                    visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                }`}
                style={{ transitionDuration: `${ENTER_MS}ms` }}
            >
                <button
                    type="button"
                    onClick={hideToast}
                    aria-label="Dismiss"
                    className="absolute right-2 top-2 inline-flex size-7 items-center justify-center text-black/40 transition-colors hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/40 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                >
                    <svg
                        viewBox="0 0 14 14"
                        aria-hidden="true"
                        className="size-3"
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
                        <p className="text-[11px] font-bold text-[#1b6f8f] sm:text-xs dark:text-[#5FC4E7]/80">
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
                        {upsell.cta.href ? (
                            <a
                                href={upsell.cta.href}
                                target={upsell.cta.external ? "_blank" : undefined}
                                rel={
                                    upsell.cta.external
                                        ? "noopener noreferrer"
                                        : undefined
                                }
                                onClick={handleLinkCtaClick}
                                className={ctaClassName}
                            >
                                {upsell.cta.label}
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={handleCopyCta}
                                className={`${ctaClassName} font-mono`}
                                aria-label={`Copy command: ${upsell.cta.label}`}
                            >
                                {upsell.cta.label}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpsellToast;
