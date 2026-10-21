"use client";

import { useRouter } from "next/navigation";
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

type AuthSessionState = Pick<AuthGate, "session" | "status">;

let sessionPromise: Promise<Session | null> | null = null;
let cachedSession: Session | null | undefined;

const SESSION_CACHE_INVALIDATED_EVENT = "examcooker:session-cache-invalidated";

export function invalidateAuthSessionCache() {
    sessionPromise = null;
    cachedSession = undefined;
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(SESSION_CACHE_INVALIDATED_EVENT));
    }
}

function readSessionPayload(payload: unknown): Session | null {
    if (!payload || typeof payload !== "object") return null;
    if (!("user" in payload) || !(payload as { user?: unknown }).user) return null;
    return payload as Session;
}

/**
 * One shared, cached `/api/auth/session` request for every client caller.
 * `refresh` re-reads it (e.g. after another tab may have signed in) without
 * putting already-rendered auth state back into loading.
 */
export function loadAuthSession({ refresh = false }: { refresh?: boolean } = {}) {
    if (refresh && cachedSession !== undefined) {
        sessionPromise = null;
        cachedSession = undefined;
    }
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

function getAuthSessionState(session: Session | null | undefined): AuthSessionState {
    if (session === undefined) {
        return { session: null, status: "loading" };
    }

    return {
        session,
        status: session ? "authenticated" : "unauthenticated",
    };
}

function getAuthHref(action?: string) {
    const callbackUrl = getCurrentRedirect();
    captureAuthPromptOpened(action);
    const params = new URLSearchParams({ callbackUrl });
    return `/auth?${params.toString()}`;
}

export function useGuestPrompt(): AuthGate {
    const router = useRouter();
    const [{ session, status }, setAuthSessionState] = useState<AuthSessionState>(
        () => getAuthSessionState(cachedSession),
    );
    const isAuthed = Boolean(session?.user);

    useEffect(() => {
        let cancelled = false;

        function syncSession() {
            setAuthSessionState(getAuthSessionState(cachedSession));

            if (cachedSession !== undefined) return;

            void loadAuthSession().then((nextSession) => {
                if (cancelled) return;
                setAuthSessionState(getAuthSessionState(nextSession));
            });
        }

        const cancelInitialSync = cachedSession === undefined
            ? scheduleIdleWork(
                syncSession,
                { fallbackDelayMs: 1200, timeoutMs: 2500 },
            )
            : null;

        window.addEventListener(SESSION_CACHE_INVALIDATED_EVENT, syncSession);

        return () => {
            cancelled = true;
            cancelInitialSync?.();
            window.removeEventListener(SESSION_CACHE_INVALIDATED_EVENT, syncSession);
        };
    }, []);

    const openPrompt = useCallback((action?: string) => {
        router.push(getAuthHref(action));
    }, [router]);

    const requireAuth = useCallback(
        (action?: string) => {
            if (isAuthed) return true;
            if (status === "loading") {
                void loadAuthSession().then((nextSession) => {
                    setAuthSessionState(getAuthSessionState(nextSession));
                    if (!nextSession?.user) {
                        router.push(getAuthHref(action));
                    }
                });
                return false;
            }
            router.push(getAuthHref(action));
            return false;
        },
        [isAuthed, router, status],
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
