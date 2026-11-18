import { useCallback, useEffect, useRef, useState } from "react";

// How long a sign-in may take to leave this page before a restart is offered.
export const SIGN_IN_STALL_MS = 10_000;

type SignInAttempt = { providerId: string; startedAt: number };

/**
 * Keeps one provider sign-in in flight at a time. `begin` locks the buttons
 * and returns a `release` for that attempt only, or null while another
 * attempt is running.
 *
 * next-auth's signIn() resolves once it has assigned the redirect URL, and its
 * requests have no timeout, so neither its result nor a timer can tell whether
 * the page is still about to navigate. The lock therefore never lifts on its
 * own: after `stallMs` it reports `stalled` so the page can offer a restart
 * that replaces the pending navigation. Returning to the page from the
 * back/forward cache ends the attempt.
 */
export function useSignInGuard(stallMs = SIGN_IN_STALL_MS) {
  const attemptRef = useRef<SignInAttempt | null>(null);
  const [attempt, setAttempt] = useState<SignInAttempt | null>(null);
  const [stalledAttempt, setStalledAttempt] = useState<SignInAttempt | null>(null);

  const end = useCallback(() => {
    attemptRef.current = null;
    setAttempt(null);
    setStalledAttempt(null);
  }, []);

  const begin = useCallback(
    (providerId: string) => {
      if (attemptRef.current) return null;
      const next = { providerId, startedAt: Date.now() };
      attemptRef.current = next;
      setAttempt(next);
      return () => {
        if (attemptRef.current === next) end();
      };
    },
    [end],
  );

  // Measured from the start of the attempt, so a page hidden and shown again
  // with the attempt still running reports the stall on time.
  useEffect(() => {
    if (!attempt) return;
    const timer = setTimeout(
      () => setStalledAttempt(attempt),
      Math.max(0, attempt.startedAt + stallMs - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [attempt, stallMs]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) end();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [end]);

  return {
    begin,
    signingInProviderId: attempt?.providerId ?? null,
    stalled: attempt !== null && stalledAttempt === attempt,
  };
}
