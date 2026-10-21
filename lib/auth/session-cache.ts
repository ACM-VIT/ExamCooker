import type { Session } from "next-auth";

// A session can end without this tab noticing (expiry, sign-out elsewhere);
// answers older than this are re-read on the next call.
const MAX_AGE_MS = 60_000;

// The request in flight, if any, shared by every caller.
let sessionPromise: Promise<Session | null> | null = null;
let cachedSession: Session | null | undefined;
let cachedAt = 0;
// Bumped on invalidation: a request started earlier must not write its result.
let sessionGeneration = 0;

function readSessionPayload(payload: unknown): Session | null {
    if (!payload || typeof payload !== "object") return null;
    if (!("user" in payload) || !(payload as { user?: unknown }).user) return null;
    return payload as Session;
}

/** The last known session: undefined until a request has answered. */
export function readCachedSession() {
    return cachedSession;
}

export function clearSessionCache() {
    sessionGeneration++;
    sessionPromise = null;
    cachedSession = undefined;
}

/**
 * One shared, cached `/api/auth/session` request for every client caller.
 * `refresh` re-reads it (e.g. after another tab may have signed in). Callers
 * share whichever request is in flight; a failed request changes nothing and
 * answers with the last known session.
 */
export function loadAuthSession({ refresh = false }: { refresh?: boolean } = {}) {
    if (sessionPromise) return sessionPromise;
    if (cachedSession !== undefined && !refresh && Date.now() - cachedAt < MAX_AGE_MS) {
        return Promise.resolve(cachedSession);
    }

    const generation = sessionGeneration;
    const previous = cachedSession;
    const request: Promise<Session | null> = fetch("/api/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
    })
        .then((response) => {
            if (!response.ok) throw new Error(`Session request failed: ${response.status}`);
            return response.json();
        })
        .then((payload) => {
            const session = readSessionPayload(payload);
            if (generation === sessionGeneration) {
                cachedSession = session;
                cachedAt = Date.now();
            }
            return session;
        })
        // Only a successful response may change what we know.
        .catch(() => previous ?? null)
        .finally(() => {
            if (sessionPromise === request) sessionPromise = null;
        });
    sessionPromise = request;
    return request;
}
