"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "next-auth";
import { captureAuthPromptOpened } from "@/lib/posthog/client";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";

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

const AUTH_SESSION_CACHE_INVALIDATED = "auth-session-cache-invalidated";

export function invalidateAuthSessionCache() {
    sessionPromise = null;
    cachedSession = undefined;
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(AUTH_SESSION_CACHE_INVALIDATED));
    }
}

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
        let cancelled = false;

        function syncSession() {
            setSession(cachedSession === undefined ? null : cachedSession);
            setStatus(
                cachedSession === undefined
                    ? "loading"
                    : cachedSession
                        ? "authenticated"
                        : "unauthenticated",
            );

            if (cachedSession !== undefined) return;

            void loadSession().then((nextSession) => {
                if (cancelled) return;
                setSession(nextSession);
                setStatus(nextSession ? "authenticated" : "unauthenticated");
            });
        }

        const cancelInitialSync = cachedSession === undefined
            ? scheduleIdleWork(
                syncSession,
                { fallbackDelayMs: 1200, timeoutMs: 2500 },
            )
            : null;

        window.addEventListener(AUTH_SESSION_CACHE_INVALIDATED, syncSession);

        return () => {
            cancelled = true;
            cancelInitialSync?.();
            window.removeEventListener(AUTH_SESSION_CACHE_INVALIDATED, syncSession);
        };
    }, []);

    const openPrompt = useCallback((action?: string) => {
        redirectToAuth(action);
    }, []);

    const requireAuth = useCallback(
        (action?: string) => {
            if (isAuthed) return true;
            if (status === "loading") {
                void loadSession().then((nextSession) => {
                    setSession(nextSession);
                    setStatus(nextSession ? "authenticated" : "unauthenticated");
                    if (!nextSession?.user) {
                        redirectToAuth(action);
                    }
                });
                return false;
            }
            redirectToAuth(action);
            return false;
        },
        [isAuthed, status],
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
