"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";

type GuestPromptContextType = {
    isAuthed: boolean;
    requireAuth: (action?: string) => boolean;
    openPrompt: (action?: string) => void;
    closePrompt: () => void;
};

type PromptState = {
    isOpen: boolean;
    action?: string;
};

const GuestPromptContext = createContext<GuestPromptContextType | undefined>(undefined);

export function useGuestPrompt() {
    const context = useContext(GuestPromptContext);
    if (!context) {
        throw new Error("useGuestPrompt must be used within GuestPromptProvider");
    }
    return context;
}

export default function GuestPromptProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const isAuthed = Boolean(session?.user);
    const [prompt, setPrompt] = useState<PromptState>({ isOpen: false });
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
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [prompt.isOpen]);

    const redirectTarget = useMemo(() => {
        if (pathname === "/") return "/home";
        const query = searchParams?.toString();
        return `${pathname || "/home"}${query ? `?${query}` : ""}`;
    }, [pathname, searchParams]);

    const signInHref = `/api/auth/init?redirect=${encodeURIComponent(redirectTarget)}`;
    const actionLabel = prompt.action ? `to ${prompt.action}` : "to continue";

    return (
        <GuestPromptContext.Provider value={{ isAuthed, requireAuth, openPrompt, closePrompt }}>
            {children}
            {prompt.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <button
                        type="button"
                        onClick={closePrompt}
                        className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"
                        aria-label="Close sign-in prompt"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="relative w-[94%] max-w-lg text-black dark:text-[#D5D5D5]"
                    >
                        <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[#3BF4C7] via-[#82BEE9] to-[#253EE0] opacity-70 blur-[18px]" />
                        <div className="relative rounded-xl border-2 border-black dark:border-[#D5D5D5] bg-[#C2E6EC] dark:bg-[#0C1222] shadow-[12px_12px_0_rgba(0,0,0,0.25)] overflow-hidden">
                            <div className="px-6 py-5 border-b border-black/20 dark:border-[#D5D5D5]/20 bg-gradient-to-r from-white/70 to-white/10 dark:from-white/5 dark:to-transparent">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-2xl md:text-3xl font-extrabold mt-2">
                                            Sign in {actionLabel}
                                        </h3>
                                        <p className="text-sm mt-2 text-black/70 dark:text-[#D5D5D5]/80">
                                            You can browse everything. To save, post, or vote you
                                            need a quick sign-in.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={closePrompt}
                                        className="border border-black/30 dark:border-[#D5D5D5]/40 text-xs font-semibold px-2 py-1 hover:bg-white/40 dark:hover:bg-white/5 transition"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                            <div className="px-6 py-5 space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <a
                                        href={signInHref}
                                        className="relative group inline-flex w-fit justify-center justify-self-center min-w-[220px]"
                                    >
                                        <span className="absolute inset-0 bg-black dark:bg-[#3BF4C7]" />
                                        <span className="absolute inset-0 blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
                                        <span className="w-full text-center dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7] dark:group-hover:border-[#3BF4C7] dark:border-[#D5D5D5] dark:bg-[#0C1222] border-black border-2 relative px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150">
                                            Sign in with Google
                                        </span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={closePrompt}
                                        className="w-fit min-w-[220px] justify-self-center border border-black/40 dark:border-[#D5D5D5]/40 px-4 py-2 text-sm font-semibold hover:bg-white/40 dark:hover:bg-white/5 transition"
                                    >
                                        Continue browsing
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </GuestPromptContext.Provider>
    );
}
