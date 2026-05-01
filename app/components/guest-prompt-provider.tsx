"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "next-auth";
import { getSession } from "next-auth/react";
import { startAppleSignIn, startGoogleSignIn } from "@/lib/start-google-sign-in";
import { captureAuthPromptOpened } from "@/lib/posthog/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faApple } from "@fortawesome/free-brands-svg-icons";

type GuestPromptContextType = {
    isAuthed: boolean;
    session: Session | null;
    status: "authenticated" | "unauthenticated" | "loading";
    requireAuth: (action?: string) => boolean;
    openPrompt: (action?: string) => void;
    closePrompt: () => void;
};

type PromptState = {
    action?: string;
    redirect?: string;
};

const GuestPromptContext = createContext<GuestPromptContextType>({
    isAuthed: false,
    session: null,
    status: "loading",
    requireAuth: () => false,
    openPrompt: () => undefined,
    closePrompt: () => undefined,
});

const PROMPT_ANIMATION_MS = 180;

export function useGuestPrompt() {
    return useContext(GuestPromptContext);
}

export default function GuestPromptProvider({
    children,
    initialSession = null,
}: {
    children: React.ReactNode;
    initialSession?: Session | null;
}) {
    const [session, setSession] = useState<Session | null>(initialSession);
    const [status, setStatus] = useState<"authenticated" | "unauthenticated" | "loading">(
        initialSession?.user ? "authenticated" : "loading",
    );
    const isAuthed = Boolean(session?.user);
    const [prompt, setPrompt] = useState<PromptState>({});
    const [phase, setPhase] = useState<"closed" | "entering" | "open" | "leaving">("closed");
    const [showAppleSignIn, setShowAppleSignIn] = useState(false);
    const openRafRef = useRef<number | null>(null);
    const closeTimerRef = useRef<number | null>(null);

    const clearPhaseTimers = useCallback(() => {
        if (openRafRef.current !== null) {
            cancelAnimationFrame(openRafRef.current);
            openRafRef.current = null;
        }
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }, []);

    const openPrompt = useCallback((action?: string) => {
        const redirect =
            typeof window === "undefined"
                ? "/"
                : `${window.location.pathname}${window.location.search}`;
        clearPhaseTimers();
        setPrompt({ action, redirect });
        if (phase === "open" || phase === "entering") return;
        captureAuthPromptOpened(action);
        setPhase("entering");
        openRafRef.current = requestAnimationFrame(() => {
            openRafRef.current = requestAnimationFrame(() => {
                setPhase("open");
                openRafRef.current = null;
            });
        });
    }, [clearPhaseTimers, phase]);

    const closePrompt = useCallback(() => {
        if (phase === "closed" || phase === "leaving") return;
        clearPhaseTimers();
        setPhase("leaving");
        closeTimerRef.current = window.setTimeout(() => {
            setPhase("closed");
            closeTimerRef.current = null;
        }, PROMPT_ANIMATION_MS);
    }, [clearPhaseTimers, phase]);

    const requireAuth = useCallback(
        (action?: string) => {
            if (isAuthed) return true;
            openPrompt(action);
            return false;
        },
        [isAuthed, openPrompt]
    );

    useEffect(() => {
        document.body.style.overflow = phase === "closed" ? "" : "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, [phase]);

    useEffect(() => {
        if (phase === "closed") return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") closePrompt();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [phase, closePrompt]);

    useEffect(() => {
        let cancelled = false;

        async function syncSession() {
            try {
                const nextSession = await getSession();
                if (cancelled) return;
                setSession(nextSession);
                setStatus(nextSession?.user ? "authenticated" : "unauthenticated");
            } catch {
                if (cancelled) return;
                setSession(null);
                setStatus("unauthenticated");
            }
        }

        void syncSession();

        return () => {
            cancelled = true;
            clearPhaseTimers();
            document.body.style.overflow = "";
        };
    }, [clearPhaseTimers]);

    useEffect(() => {
        let cancelled = false;

        async function checkAppleSignInAvailability() {
            const isBrowserIos =
                /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
            let isNativeIos = false;

            try {
                const { Capacitor } = await import("@capacitor/core");
                isNativeIos =
                    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
            } catch {
                isNativeIos = false;
            }

            if (cancelled || (!isNativeIos && !isBrowserIos)) {
                return;
            }

            try {
                const response = await fetch("/api/auth/providers", {
                    headers: { Accept: "application/json" },
                });
                const providers = (await response.json()) as Record<string, unknown>;
                if (!cancelled) {
                    setShowAppleSignIn(Boolean(providers.apple));
                }
            } catch {
                if (!cancelled) {
                    setShowAppleSignIn(false);
                }
            }
        }

        void checkAppleSignInAvailability();

        return () => {
            cancelled = true;
        };
    }, []);

    const actionLabel = prompt.action ? `to ${prompt.action}` : "to continue";
    const visible = phase === "open";
    const mounted = phase !== "closed";
    const handleSignIn = useCallback(() => {
        startGoogleSignIn(prompt.redirect ?? "/", {
            source: "guest_prompt",
        });
    }, [prompt.redirect]);
    const handleAppleSignIn = useCallback(() => {
        startAppleSignIn(prompt.redirect ?? "/", {
            source: "guest_prompt",
        });
    }, [prompt.redirect]);

    return (
        <GuestPromptContext.Provider
            value={{ isAuthed, session, status, requireAuth, openPrompt, closePrompt }}
        >
            {children}
            {mounted && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-5 sm:p-4">
                    <button
                        type="button"
                        onClick={closePrompt}
                        className={`absolute inset-0 bg-black/50 transition-opacity ease-out ${
                            visible ? "opacity-100" : "opacity-0"
                        }`}
                        style={{ transitionDuration: `${PROMPT_ANIMATION_MS}ms` }}
                        aria-label="Dismiss"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="guest-prompt-title"
                        className={`relative w-full max-w-[19.5rem] border border-black/70 bg-white text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.75)] transition-[opacity,transform] ease-out dark:border-[#D5D5D5]/70 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[2px_2px_0_0_rgba(59,244,199,0.25)] sm:max-w-sm sm:border-2 sm:border-black sm:shadow-[4px_4px_0_0_rgba(0,0,0,1)] sm:dark:border-[#D5D5D5] sm:dark:shadow-[4px_4px_0_0_rgba(59,244,199,0.35)] ${
                            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                        }`}
                        style={{ transitionDuration: `${PROMPT_ANIMATION_MS}ms` }}
                    >
                        <button
                            type="button"
                            onClick={closePrompt}
                            aria-label="Close"
                            className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center text-black/50 transition-colors hover:text-black dark:text-[#D5D5D5]/60 dark:hover:text-[#3BF4C7] sm:right-3 sm:top-3"
                        >
                            <svg
                                viewBox="0 0 14 14"
                                aria-hidden="true"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            >
                                <path d="M1 1L13 13M13 1L1 13" />
                            </svg>
                        </button>
                        <div className="px-4.5 pb-5 pt-7 sm:px-6 sm:pb-6 sm:pt-8">
                            <h3
                                id="guest-prompt-title"
                                className="pr-8 text-lg font-bold leading-tight sm:text-xl"
                            >
                                Sign in {actionLabel}
                            </h3>
                            <p className="mt-2 text-[13px] text-black/60 dark:text-[#D5D5D5]/60 sm:text-sm">
                                A quick sign-in is all it takes.
                            </p>
                            {showAppleSignIn ? (
                                <button
                                    type="button"
                                    onClick={handleAppleSignIn}
                                    className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 border border-black bg-black text-sm font-bold text-white transition duration-150 hover:bg-black/85 dark:border-[#D5D5D5] dark:bg-[#D5D5D5] dark:text-black dark:hover:bg-white sm:h-11 sm:text-base"
                                >
                                    <FontAwesomeIcon icon={faApple} className="h-4 w-4" />
                                    Sign in with Apple
                                </button>
                            ) : null}
                            <div className={`group relative inline-flex w-full items-stretch ${showAppleSignIn ? "mt-3" : "mt-5"}`}>
                                <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]" />
                                <div className="absolute inset-0 bg-[#3BF4C7] blur-[60px] opacity-0 transition duration-200 group-hover:opacity-20 dark:hidden" />
                                <div className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
                                <button
                                    type="button"
                                    onClick={handleSignIn}
                                    className="relative inline-flex h-10 w-full items-center justify-center border border-black/75 bg-[#3BF4C7] text-sm font-bold text-black transition duration-150 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 dark:border-[#D5D5D5]/75 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7] sm:h-11 sm:border-2 sm:border-black sm:text-base sm:group-hover:-translate-x-1 sm:group-hover:-translate-y-1 sm:dark:border-[#D5D5D5]"
                                >
                                    Sign in with Google
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </GuestPromptContext.Provider>
    );
}
