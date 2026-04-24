"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type GuestPromptContextType = {
    isAuthed: boolean;
    status: "authenticated" | "unauthenticated" | "loading";
    requireAuth: (action?: string) => boolean;
    openPrompt: (action?: string) => void;
    closePrompt: () => void;
};

type PromptState = {
    action?: string;
    redirect?: string;
};

const GuestPromptContext = createContext<GuestPromptContextType | undefined>(undefined);

const PROMPT_ANIMATION_MS = 180;

export function useGuestPrompt() {
    const context = useContext(GuestPromptContext);
    if (!context) {
        throw new Error("useGuestPrompt must be used within GuestPromptProvider");
    }
    return context;
}

export default function GuestPromptProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const isAuthed = Boolean(session?.user);
    const [prompt, setPrompt] = useState<PromptState>({});
    const [phase, setPhase] = useState<"closed" | "entering" | "open" | "leaving">("closed");
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
        return () => {
            clearPhaseTimers();
            document.body.style.overflow = "";
        };
    }, [clearPhaseTimers]);

    const signInHref = `/api/auth/init?redirect=${encodeURIComponent(prompt.redirect ?? "/")}`;
    const actionLabel = prompt.action ? `to ${prompt.action}` : "to continue";
    const visible = phase === "open";
    const mounted = phase !== "closed";
    const handleSignIn = useCallback(() => {
        if (typeof window !== "undefined") {
            window.location.assign(signInHref);
        }
    }, [signInHref]);

    return (
        <GuestPromptContext.Provider value={{ isAuthed, status, requireAuth, openPrompt, closePrompt }}>
            {children}
            {mounted && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
                        className={`relative w-full max-w-sm border-2 border-black bg-white text-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-[opacity,transform] ease-out dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[4px_4px_0_0_rgba(59,244,199,0.35)] ${
                            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                        }`}
                        style={{ transitionDuration: `${PROMPT_ANIMATION_MS}ms` }}
                    >
                        <button
                            type="button"
                            onClick={closePrompt}
                            aria-label="Close"
                            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center text-black/50 transition-colors hover:text-black dark:text-[#D5D5D5]/60 dark:hover:text-[#3BF4C7]"
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
                        <div className="px-6 pb-6 pt-8">
                            <h3
                                id="guest-prompt-title"
                                className="pr-8 text-xl font-bold leading-tight"
                            >
                                Sign in {actionLabel}
                            </h3>
                            <p className="mt-2 text-sm text-black/60 dark:text-[#D5D5D5]/60">
                                A quick sign-in is all it takes.
                            </p>
                            <button
                                type="button"
                                onClick={handleSignIn}
                                className="mt-5 inline-flex h-11 w-full items-center justify-center border-2 border-black bg-[#3BF4C7] text-base font-bold text-black transition duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7] dark:hover:text-[#3BF4C7]"
                            >
                                Sign in with Google
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </GuestPromptContext.Provider>
    );
}
