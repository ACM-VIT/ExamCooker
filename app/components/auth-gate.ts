"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "next-auth";
import { captureAuthPromptOpened } from "@/lib/posthog/client";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";
import { clearSessionCache, loadAuthSession, readCachedSession } from "@/lib/auth/session-cache";

type AuthGate = {
    isAuthed: boolean;
    session: Session | null;
    status: "authenticated" | "unauthenticated" | "loading";
    /**
     * True when signed in. While the session is still unknown it returns false
     * and checks; `onAuthed` then runs if the user turns out to be signed in,
     * so their click is not silently dropped.
     */
    requireAuth: (action?: string, onAuthed?: () => void) => boolean;
    openPrompt: (action?: string) => void;
    closePrompt: () => void;
};

type AuthSessionState = Pick<AuthGate, "session" | "status">;

const SESSION_CACHE_INVALIDATED_EVENT = "examcooker:session-cache-invalidated";

export function invalidateAuthSessionCache() {
    clearSessionCache();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(SESSION_CACHE_INVALIDATED_EVENT));
    }
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
        () => getAuthSessionState(readCachedSession()),
    );
    const isAuthed = Boolean(session?.user);
    // Only the latest read may update this hook; an older one that answers
    // later would otherwise overwrite a newer answer.
    const latestReadRef = useRef(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            latestReadRef.current++;
        };
    }, []);

    useEffect(() => {
        // The loader answers from its cache while that is fresh and re-reads
        // it once it is old, so a session that ended elsewhere is noticed.
        function syncSession() {
            const read = ++latestReadRef.current;
            setAuthSessionState(getAuthSessionState(readCachedSession()));

            void loadAuthSession()
                .then((nextSession) => {
                    if (read !== latestReadRef.current) return;
                    setAuthSessionState(getAuthSessionState(nextSession));
                })
                // Unknown session: show signed-out controls here without
                // remembering it, so the next read asks again. The sign-in
                // page sends signed-in users back.
                .catch(() => {
                    if (read !== latestReadRef.current) return;
                    setAuthSessionState(getAuthSessionState(null));
                });
        }

        const cancelInitialSync = scheduleIdleWork(
            syncSession,
            { fallbackDelayMs: 1200, timeoutMs: 2500 },
        );

        window.addEventListener(SESSION_CACHE_INVALIDATED_EVENT, syncSession);

        return () => {
            cancelInitialSync();
            window.removeEventListener(SESSION_CACHE_INVALIDATED_EVENT, syncSession);
        };
    }, []);

    const openPrompt = useCallback((action?: string) => {
        router.push(getAuthHref(action));
    }, [router]);

    const requireAuth = useCallback(
        (action?: string, onAuthed?: () => void) => {
            if (isAuthed) return true;
            if (status === "loading") {
                const read = ++latestReadRef.current;
                void loadAuthSession()
                    .then((nextSession) => {
                        if (!mountedRef.current) return;
                        if (read === latestReadRef.current) {
                            setAuthSessionState(getAuthSessionState(nextSession));
                        }
                        if (nextSession?.user) onAuthed?.();
                        else router.push(getAuthHref(action));
                    })
                    .catch(() => {
                        if (mountedRef.current) router.push(getAuthHref(action));
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
