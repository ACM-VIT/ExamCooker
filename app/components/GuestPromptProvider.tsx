"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";

type GuestPromptContextType = {
    isAuthed: boolean;
    status: "authenticated" | "unauthenticated" | "loading";
    requireAuth: (action?: string) => boolean;
    openPrompt: (action?: string) => void;
    closePrompt: () => void;
};

type PromptState = {
    isOpen: boolean;
    action?: string;
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
    const [prompt, setPrompt] = useState<PromptState>({ isOpen: false });
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const openPrompt = useCallback((action?: string) => {
        setPrompt({ isOpen: true, action });
    }, []);

    const closePrompt = useCallback(() => {
        setPrompt((prev) => ({ ...prev, isOpen: false }));
    }, []);

    const requireAuth = useCallback(
        (action?: string) => {
            if (isAuthed) return true;
            openPrompt(action);
            return false;
        },
        [isAuthed, openPrompt]
    );

    useEffect(() => {
        if (prompt.isOpen) {
            setMounted(true);
            document.body.style.overflow = "hidden";
            const raf = requestAnimationFrame(() => {
                requestAnimationFrame(() => setVisible(true));
            });
            return () => {
                cancelAnimationFrame(raf);
                document.body.style.overflow = "";
            };
        }
        setVisible(false);
        document.body.style.overflow = "";
        const timer = window.setTimeout(() => {
            setMounted(false);
        }, PROMPT_ANIMATION_MS);
        return () => {
            window.clearTimeout(timer);
        };
    }, [prompt.isOpen]);

    useEffect(() => {
        if (!prompt.isOpen) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") closePrompt();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [prompt.isOpen, closePrompt]);

    const redirectTarget = useMemo(() => {
        if (pathname === "/") return "/home";
        const query = searchParams?.toString();
        return `${pathname || "/home"}${query ? `?${query}` : ""}`;
    }, [pathname, searchParams]);

    const signInHref = `/api/auth/init?redirect=${encodeURIComponent(redirectTarget)}`;
    const actionLabel = prompt.action ? `to ${prompt.action}` : "to continue";

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
                        className={`relative w-full max-w-sm border-2 border-black bg-white text-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all ease-out dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[4px_4px_0_0_rgba(59,244,199,0.35)] ${
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
                            <a
                                href={signInHref}
                                className="mt-5 inline-flex h-11 w-full items-center justify-center border-2 border-black bg-[#3BF4C7] text-base font-bold text-black transition duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7] dark:hover:text-[#3BF4C7]"
                            >
                                Sign in with Google
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </GuestPromptContext.Provider>
    );
}
