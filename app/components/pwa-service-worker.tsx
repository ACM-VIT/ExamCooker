"use client";

import { useEffect } from "react";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";

const NATIVE_PREFETCH_ROUTES = [
  "/",
  "/past_papers",
  "/notes",
  "/syllabus",
  "/resources",
];

export default function PwaServiceWorker() {
  useEffect(() => {
    let cancelled = false;
    let registeredWorker: ServiceWorker | null = null;
    let registration: ServiceWorkerRegistration | null = null;
    let handleStateChange: (() => void) | null = null;
    let handleUpdateFound: (() => void) | null = null;
    let cancelRoutePrefetch: (() => void) | null = null;

    const cleanupServiceWorkerListeners = () => {
      cancelRoutePrefetch?.();

      if (registeredWorker && handleStateChange) {
        registeredWorker.removeEventListener("statechange", handleStateChange);
      }

      if (registration && handleUpdateFound) {
        registration.removeEventListener("updatefound", handleUpdateFound);
      }

      registeredWorker = null;
      registration = null;
      handleStateChange = null;
      handleUpdateFound = null;
      cancelRoutePrefetch = null;
    };

    async function configureServiceWorker() {
      if (!("serviceWorker" in navigator)) {
        return;
      }

      const { Capacitor } = await import("@capacitor/core");
      if (cancelled) return;

      const isNative = Capacitor.isNativePlatform();

      if (!isNative && process.env.NODE_ENV !== "production") {
        return;
      }

      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        const requestPrefetch = (worker: ServiceWorker | null) => {
          if (!isNative || !worker) return;
          cancelRoutePrefetch?.();
          cancelRoutePrefetch = scheduleIdleWork(() => {
            worker.postMessage({
              type: "PREFETCH_ROUTES",
              routes: NATIVE_PREFETCH_ROUTES,
            });
          }, {
            fallbackDelayMs: 2500,
            timeoutMs: 6500,
          });
        };

        if (registration.active) {
          requestPrefetch(registration.active);
        } else {
          handleUpdateFound = () => {
            const installing = registration?.installing ?? null;
            if (!installing) {
              return;
            }

            registeredWorker = installing;
            handleStateChange = () => {
              if (installing.state === "activated") {
                requestPrefetch(installing);
                cleanupServiceWorkerListeners();
              }
            };

            installing.addEventListener("statechange", handleStateChange);
          };

          registration.addEventListener("updatefound", handleUpdateFound);
        }
      } catch {
        // PWA support should not block the app if registration is unavailable.
      }
    }

    configureServiceWorker().catch(() => {
      // Cache cleanup/PWA registration is best-effort and must not block app load.
    });

    return () => {
      cancelled = true;
      cleanupServiceWorkerListeners();
    };
  }, []);

  return null;
}
