import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Tracks a report submitted while the session was still loading.
 *
 * `startWait` marks the wait and returns `isCurrent`, which the session check
 * consults before it sends the report or redirects to sign-in. `endWait`
 * releases the form and retires that check, so the user can cancel a session
 * request that stalls and a late answer then does nothing. Hiding the page
 * (Cache Components keep it mounted in `<Activity>`) ends the wait too.
 */
export function useCorrectionSessionWait() {
  const [awaitingSession, setAwaitingSession] = useState(false);
  const waitRef = useRef(0);

  const startWait = useCallback(() => {
    const wait = ++waitRef.current;
    setAwaitingSession(true);
    return () => wait === waitRef.current;
  }, []);

  const endWait = useCallback(() => {
    waitRef.current++;
    setAwaitingSession(false);
  }, []);

  useLayoutEffect(() => endWait, [endWait]);

  return { awaitingSession, startWait, endWait };
}
