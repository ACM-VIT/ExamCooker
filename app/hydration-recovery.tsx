"use client";

import { useEffect, useRef } from "react";
import { captureHydrationMismatchRecovered } from "@/lib/posthog/client";
import {
  claimChunkReload,
  getRecoveryKey,
  isHydrationError,
} from "./global-error-reload-guard";

// React reports hydration mismatches (#418/#419 and friends) as *recoverable*
// errors: they never reach `global-error.tsx`, and Next surfaces them by
// re-dispatching a global `error` event (which is also how they show up as
// `$exception`). React then throws away the server HTML and re-renders on the
// client, which can strand a corrupted DOM — blank pages, broken image icons,
// garbled text, and detached click handlers — with no way for the user to
// recover except leaving.
//
// This listener is the `onRecoverableError` safety net: it watches for that
// hydration signature and performs the same guarded, one-time `location.reload()`
// recovery `global-error.tsx` already does for `ChunkLoadError`, so a mismatch
// self-heals into a clean SSR + hydration instead of leaving a broken viewer.
// The reload guard bounds us to a single reload per signature per minute, so a
// deterministic mismatch reports telemetry and falls back to React's own
// client re-render instead of looping.
function extractReactErrorNumber(message: string): number | null {
  const match = message.match(/(?:Minified React error #|errors\/)(\d+)/i);
  return match ? Number(match[1]) : null;
}

export default function HydrationRecovery() {
  // A single mismatch can surface several recoverable errors in one tick.
  // Handle at most once per load so we neither spam telemetry nor race the
  // reload we are about to trigger.
  const handledRef = useRef(false);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (handledRef.current) return;
      const error = event.error ?? event.message;
      if (!isHydrationError(error)) return;
      handledRef.current = true;

      const message =
        (event.error instanceof Error ? event.error.message : null) ??
        (typeof event.message === "string" ? event.message : "");
      const path =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "";
      const reloadTriggered = claimChunkReload(
        getRecoveryKey(event.error ?? { message }, "hydration"),
      );

      const telemetry = captureHydrationMismatchRecovered({
        path,
        reactErrorNumber: extractReactErrorNumber(message),
        errorMessage: message,
        reloadTriggered,
      });

      if (!reloadTriggered) {
        return;
      }

      // Give the telemetry a chance to flush (it sends via `sendBeacon`, which
      // survives navigation) before we reload, but never let a stalled capture
      // block recovery — reload after 1s regardless.
      void Promise.race([
        telemetry,
        new Promise<void>((resolve) => window.setTimeout(resolve, 1000)),
      ]).finally(() => window.location.reload());
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  return null;
}
