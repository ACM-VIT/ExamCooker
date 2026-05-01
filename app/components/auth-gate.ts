"use client";

import { useCallback } from "react";
import type { Session } from "next-auth";
import { useSession } from "next-auth/react";
import { captureAuthPromptOpened } from "@/lib/posthog/client";

type AuthGate = {
    isAuthed: boolean;
    session: Session | null;
    status: "authenticated" | "unauthenticated" | "loading";
    requireAuth: (action?: string) => boolean;
    openPrompt: (action?: string) => void;
    closePrompt: () => void;
};

function getCurrentRedirect() {
    if (typeof window === "undefined") return "/";
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function redirectToAuth(action?: string) {
    const callbackUrl = getCurrentRedirect();
    captureAuthPromptOpened(action);
    const params = new URLSearchParams({ callbackUrl });
    window.location.assign(`/auth?${params.toString()}`);
}

export function useGuestPrompt(): AuthGate {
    const { data: session, status } = useSession();
    const isAuthed = Boolean(session?.user);

    const openPrompt = useCallback((action?: string) => {
        redirectToAuth(action);
    }, []);

    const requireAuth = useCallback(
        (action?: string) => {
            if (isAuthed) return true;
            redirectToAuth(action);
            return false;
        },
        [isAuthed],
    );

    return {
        isAuthed,
        session,
        status,
        requireAuth,
        openPrompt,
        closePrompt: () => undefined,
    };
}
