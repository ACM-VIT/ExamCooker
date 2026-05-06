"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { buildIosNativeTabConfigs } from "@/lib/ios-native-tab-config";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";

function navigateFromDeepLink(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "examcooker:") {
      const path = `/${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (
        path &&
        path !== window.location.pathname + window.location.search + window.location.hash
      ) {
        window.location.assign(path);
      }
      return;
    }

    const hostOk =
      parsed.hostname === "examcooker.acmvit.in" ||
      parsed.hostname === "beta.examcooker.acmvit.in" ||
      parsed.hostname.endsWith(".azurewebsites.net");
    if (!hostOk) {
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

function isDarkTheme() {
  const root = document.documentElement;
  const explicitTheme = root.dataset.theme;

  if (explicitTheme === "dark") return true;
  if (explicitTheme === "light") return false;

  return (
    root.classList.contains("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function currentLocationPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function normalizeNativeTabRoute(route: unknown) {
  if (typeof route !== "string" || route.length === 0) return "/";
  return route.startsWith("/") ? route : `/${route}`;
}

export default function CapacitorBridge() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let cleanupStatusBar: (() => void) | undefined;
    let cleanupNativeBridge: (() => void) | undefined;
    let cleanupNativeTabs: (() => void) | undefined;

    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || cancelled) return;

      const [{ SplashScreen }, { StatusBar, Style }, { App }] = await Promise.all([
        import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"),
        import("@capacitor/app"),
      ]);
      if (cancelled) return;

      const platform = Capacitor.getPlatform();
      const root = document.documentElement;
      root.dataset.nativePlatform = platform;
      root.toggleAttribute("data-native-android", platform === "android");
      root.toggleAttribute("data-native-ios", platform === "ios");

      await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
      const applyStatusBarAppearance = () => {
        const dark = isDarkTheme();
        void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(
          () => undefined,
        );
        void StatusBar.setBackgroundColor({
          color: dark ? "#0C1222" : "#C2E6EC",
        }).catch(() => undefined);
      };
      applyStatusBarAppearance();

      const themeObserver = new MutationObserver(applyStatusBarAppearance);
      themeObserver.observe(document.documentElement, {
        attributeFilter: ["class", "data-theme", "style"],
      });

      const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      colorSchemeQuery.addEventListener("change", applyStatusBarAppearance);
      cleanupStatusBar = () => {
        themeObserver.disconnect();
        colorSchemeQuery.removeEventListener("change", applyStatusBarAppearance);
      };

      if (platform === "ios" || platform === "android") {
        try {
          const { NativeTabs } = await import("capacitor-native-tabs");
          const tabs = buildIosNativeTabConfigs();
          tabs.forEach((tab) => router.prefetch(normalizeNativeTabRoute(tab.route)));
          const pathname = window.location.pathname;
          const idx = APP_NAV_LINKS.findIndex((link) =>
            link.matches ? link.matches(pathname) : pathname === link.href,
          );
          const selectedIndex = idx >= 0 ? idx : 0;
          await NativeTabs.initialize({ tabs, selectedIndex });
          document.documentElement.setAttribute("data-native-tabs", "true");
          document.documentElement.setAttribute(
            platform === "ios" ? "data-native-ios-tabs" : "data-native-android-tabs",
            "true",
          );
          const tabSelectionListener = await NativeTabs.addListener("tabSelected", (info) => {
            const route = info.tab.route ?? "/";
            const nextPath = route.startsWith("/") ? route : `/${route}`;
            if (nextPath === currentLocationPath()) return;
            router.push(nextPath);
          });
          cleanupNativeTabs = () => {
            void tabSelectionListener.remove();
          };
          await NativeTabs.showTabBar().catch(() => undefined);
        } catch {
          document.documentElement.removeAttribute("data-native-tabs");
          document.documentElement.removeAttribute("data-native-ios-tabs");
          document.documentElement.removeAttribute("data-native-android-tabs");
          window.dispatchEvent(new Event("examcooker:use-web-tab-bar"));
        }
      }

      const launchUrl = await App.getLaunchUrl().catch(() => ({ url: "" }));
      if (launchUrl?.url) {
        navigateFromDeepLink(launchUrl.url);
      }

      void App.addListener("appUrlOpen", (event) => {
        if (event.url.startsWith("examcooker://native-auth/")) {
          void import("@capacitor/browser").then(({ Browser }) =>
            Browser.close().catch(() => undefined),
          );
        }
        navigateFromDeepLink(event.url);
      });

      if (platform === "android") {
        const backButtonListener = await App.addListener("backButton", async ({ canGoBack }) => {
          const backEvent = new CustomEvent("examcooker:native-back", {
            bubbles: true,
            cancelable: true,
          });
          const handled = !window.dispatchEvent(backEvent);
          if (handled) {
            return;
          }

          if (canGoBack && window.history.length > 1) {
            window.history.back();
            return;
          }

          await App.minimizeApp().catch(() => App.exitApp().catch(() => undefined));
        });

        cleanupNativeBridge = () => {
          void backButtonListener.remove();
        };
      }

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
      cleanupStatusBar?.();
      cleanupNativeBridge?.();
      cleanupNativeTabs?.();
      const root = document.documentElement;
      delete root.dataset.nativePlatform;
      root.removeAttribute("data-native-tabs");
      root.removeAttribute("data-native-android");
      root.removeAttribute("data-native-ios");
      root.removeAttribute("data-native-ios-tabs");
      root.removeAttribute("data-native-android-tabs");
    };
  }, [router]);

  return null;
}
