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
        <GuestPromptContext.Provider value={{ isAuthed, status, requireAuth, openPrompt, closePrompt }}>
            {children}
            {prompt.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <button
                        type="button"
                        onClick={closePrompt}
                        className="absolute inset-0 bg-black/40"
                        aria-label="Close sign-in prompt"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="relative w-[94%] max-w-lg text-black dark:text-[#D5D5D5]"
                    >
                        <div className="relative rounded-xl border border-black/30 dark:border-[#D5D5D5]/30 bg-[#C2E6EC] dark:bg-[#0C1222] shadow-lg overflow-hidden">
                            <div className="px-6 py-5 border-b border-black/10 dark:border-[#D5D5D5]/10">
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
                                        className="border border-black/20 dark:border-[#D5D5D5]/30 text-xs font-semibold px-2 py-1 hover:bg-white/30 dark:hover:bg-white/5 transition"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                            <div className="px-6 py-5 space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <a
                                        href={signInHref}
                                        className="inline-flex w-full justify-center"
                                    >
                                        <span className="w-full text-center dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7] dark:group-hover:border-[#3BF4C7] dark:border-[#D5D5D5] dark:bg-[#0C1222] border-black border-2 px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold transition duration-150">
                                            Sign in with Google
                                        </span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={closePrompt}
                                        className="w-full border border-black/30 dark:border-[#D5D5D5]/30 px-4 py-2 text-sm font-semibold hover:bg-white/30 dark:hover:bg-white/5 transition"
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
