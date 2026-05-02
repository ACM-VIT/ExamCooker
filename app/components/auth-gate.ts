"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "next-auth";
import { captureAuthPromptOpened } from "@/lib/posthog/client";

type AuthGate = {
    isAuthed: boolean;
    session: Session | null;
    status: "authenticated" | "unauthenticated" | "loading";
    requireAuth: (action?: string) => boolean;
    openPrompt: (action?: string) => void;
    closePrompt: () => void;
};

let sessionPromise: Promise<Session | null> | null = null;
let cachedSession: Session | null | undefined;

function readSessionPayload(payload: unknown): Session | null {
    if (!payload || typeof payload !== "object") return null;
    if (!("user" in payload) || !(payload as { user?: unknown }).user) return null;
    return payload as Session;
}

function loadSession() {
    if (cachedSession !== undefined) {
        return Promise.resolve(cachedSession);
    }

    if (!sessionPromise) {
        sessionPromise = fetch("/api/auth/session", {
            credentials: "same-origin",
            cache: "no-store",
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
                cachedSession = readSessionPayload(payload);
                return cachedSession;
            })
            .catch(() => {
                cachedSession = null;
                return null;
            });
    }

    return sessionPromise;
}

function scheduleIdleWork(callback: () => void) {
    if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(callback, { timeout: 2500 });
        return () => window.cancelIdleCallback(id);
    }

    const id = globalThis.setTimeout(callback, 1200);
    return () => globalThis.clearTimeout(id);
}

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
    const [session, setSession] = useState<Session | null>(
        cachedSession === undefined ? null : cachedSession,
    );
    const [status, setStatus] = useState<AuthGate["status"]>(
        cachedSession === undefined
            ? "loading"
            : cachedSession
                ? "authenticated"
                : "unauthenticated",
    );
    const isAuthed = Boolean(session?.user);

    useEffect(() => {
        if (cachedSession !== undefined) return;

        let cancelled = false;
        const cancel = scheduleIdleWork(() => {
            void loadSession().then((nextSession) => {
                if (cancelled) return;
                setSession(nextSession);
                setStatus(nextSession ? "authenticated" : "unauthenticated");
            });
        });

        return () => {
            cancelled = true;
            cancel();
        };
    }, []);

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
