"use client";

import { useEffect } from "react";
import { buildIosNativeTabConfigs } from "@/lib/ios-native-tab-config";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";

function navigateFromDeepLink(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const hostOk =
      parsed.hostname === "examcooker.acmvit.in" ||
      parsed.hostname === "beta.examcooker.acmvit.in" ||
      parsed.hostname.endsWith(".azurewebsites.net");
    if (!hostOk && parsed.protocol !== "examcooker:") {
      return;
    }
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (path && path !== window.location.pathname + window.location.search + window.location.hash) {
      window.location.assign(path);
    }
  } catch {
    // ignore malformed URLs
  }
}

export default function CapacitorBridge() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || cancelled) return;

      const [{ SplashScreen }, { StatusBar, Style }, { App }] = await Promise.all([
        import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"),
        import("@capacitor/app"),
      ]);

      await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
      await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      await StatusBar.setBackgroundColor({ color: "#0C1222" }).catch(() => undefined);

      if (Capacitor.getPlatform() === "ios") {
        try {
          const { NativeTabs } = await import("capacitor-native-tabs");
          const tabs = buildIosNativeTabConfigs();
          const pathname = window.location.pathname;
          const idx = APP_NAV_LINKS.findIndex((link) =>
            link.matches ? link.matches(pathname) : pathname === link.href,
          );
          const selectedIndex = idx >= 0 ? idx : 0;
          await NativeTabs.initialize({ tabs, selectedIndex });
          document.documentElement.setAttribute("data-native-ios-tabs", "true");
          await NativeTabs.addListener("tabSelected", (info) => {
            const route = info.tab.route ?? "/";
            const nextPath = route.startsWith("/") ? route : `/${route}`;
            if (nextPath !== window.location.pathname) {
              window.dispatchEvent(
                new CustomEvent("examcooker:native-tab-route", {
                  detail: { path: nextPath },
                }),
              );
            }
          });
          await NativeTabs.showTabBar().catch(() => undefined);
        } catch {
          document.documentElement.removeAttribute("data-native-ios-tabs");
          window.dispatchEvent(new Event("examcooker:use-web-tab-bar"));
        }
      }

      void App.addListener("appUrlOpen", (event) => {
        navigateFromDeepLink(event.url);
      });

      const hideSplash = () => {
        void SplashScreen.hide({ fadeOutDuration: 220 }).catch(() => undefined);
      };

      if (document.readyState === "complete") {
        hideSplash();
      } else {
        window.addEventListener("load", hideSplash, { once: true });
      }

      if (
        process.env.NEXT_PUBLIC_ENABLE_NATIVE_PUSH === "1" ||
        process.env.NEXT_PUBLIC_ENABLE_NATIVE_PUSH === "true"
      ) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        await PushNotifications.requestPermissions().catch(() => undefined);
        await PushNotifications.addListener("registration", async (token) => {
          try {
            await fetch("/api/native/push-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: token.value,
                platform: Capacitor.getPlatform(),
              }),
            });
          } catch {
            // non-blocking
          }
        });
        await PushNotifications.register().catch(() => undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
