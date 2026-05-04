"use client";

import { useEffect } from "react";

export default function PwaServiceWorker() {
  useEffect(() => {
    let cancelled = false;

    async function configureServiceWorker() {
      if (!("serviceWorker" in navigator)) {
        return;
      }

      const { Capacitor } = await import("@capacitor/core");
      if (cancelled) {
        return;
      }

      if (Capacitor.isNativePlatform()) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }
        return;
      }

      if (process.env.NODE_ENV !== "production") {
        return;
      }

      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA support should not block the app if registration is unavailable.
      });
    }

    configureServiceWorker().catch(() => {
      // Cache cleanup/PWA registration is best-effort and must not block app load.
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
