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

    const cleanupServiceWorkerListeners = (cancelPrefetch = true) => {
      if (cancelPrefetch) {
        cancelRoutePrefetch?.();
        cancelRoutePrefetch = null;
      }

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

        const watchInstallingWorker = (worker: ServiceWorker | null) => {
          if (!worker) return false;

          registeredWorker = worker;
          if (worker.state === "activated") {
            requestPrefetch(worker);
            cleanupServiceWorkerListeners(false);
            return true;
          }

          handleStateChange = () => {
            if (worker.state === "activated") {
              requestPrefetch(worker);
              cleanupServiceWorkerListeners(false);
            }
          };

          worker.addEventListener("statechange", handleStateChange);
          return true;
        };

        if (registration.active) {
          requestPrefetch(registration.active);
        } else if (watchInstallingWorker(registration.installing ?? registration.waiting)) {
          return;
        } else {
          handleUpdateFound = () => {
            watchInstallingWorker(registration?.installing ?? null);
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
