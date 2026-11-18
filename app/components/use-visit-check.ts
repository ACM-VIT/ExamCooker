import { useCallback, useEffect, useRef } from "react";

/**
 * Returns `startCheck`, which marks the start of async work and returns
 * `isCurrent`. That stays true until the component is hidden or unmounted.
 * With Cache Components a hidden page is shown again with its state, so work
 * started before the user left must not act once they come back.
 */
export function useVisitCheck() {
  const visitRef = useRef(0);

  useEffect(() => () => {
    visitRef.current++;
  }, []);

  return useCallback(() => {
    const visit = visitRef.current;
    return () => visit === visitRef.current;
  }, []);
}
