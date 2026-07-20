"use client";

import { useEffect } from "react";
import { captureHydrationMismatchRecovered } from "@/lib/posthog/client";
import { HYDRATION_RECOVERY_INCIDENT_KEY } from "./global-error-reload-guard";

// The detection + guarded-reload half of the hydration recovery lives in an
// inline `beforeInteractive` script (see `app/layout.tsx`), NOT here. React
// reports #418/#419 hydration mismatches *during* the initial hydration pass —
// before any `useEffect` runs — so a listener registered from a React effect
// would miss the first (and often only) blank/corrupted viewer of the session.
// The early script installs a global `error` listener before hydration, does
// the guarded one-time `location.reload()`, and records the incident in
// sessionStorage.
//
// This component is the reporter: it reads that recorded incident once the page
// has hydrated and is stable (either after the reload completed, or on the same
// load when no reload was warranted) and sends the telemetry. Reporting from a
// stable page means the capture never races the reload that would otherwise
// cancel the in-flight request.
function extractReactErrorNumber(message: string): number | null {
  const match = message.match(/(?:Minified React error #|errors\/)(\d+)/i);
  return match ? Number(match[1]) : null;
}

type HydrationIncident = {
  path?: unknown;
  message?: unknown;
  reloadTriggered?: unknown;
};

export default function HydrationRecovery() {
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(HYDRATION_RECOVERY_INCIDENT_KEY);
      if (raw) {
        // Clear immediately so the incident is reported exactly once, even
        // across later soft navigations that keep this component mounted.
        window.sessionStorage.removeItem(HYDRATION_RECOVERY_INCIDENT_KEY);
      }
    } catch {
      return;
    }

    if (!raw) return;

    let incident: HydrationIncident | null = null;
    try {
      incident = JSON.parse(raw) as HydrationIncident;
    } catch {
      return;
    }
    if (!incident) return;

    const message =
      typeof incident.message === "string" ? incident.message : "";
    const path =
      typeof incident.path === "string"
        ? incident.path
        : window.location.pathname + window.location.search;

    captureHydrationMismatchRecovered({
      path,
      reactErrorNumber: extractReactErrorNumber(message),
      errorMessage: message,
      reloadTriggered: incident.reloadTriggered === true,
    });
  }, []);

  return null;
}
