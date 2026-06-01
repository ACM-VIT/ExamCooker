"use client";

import { startTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { buildIosNativeTabConfigs } from "@/lib/ios-native-tab-config";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";

const EXAMCOOKER_LINK_HOSTS = new Set([
  "examcooker.acmvit.in",
  "beta.examcooker.acmvit.in",
  "examcooker-2024.azurewebsites.net",
  "examcooker-beta-2024.azurewebsites.net",
]);

type NativeListenerHandle = {
  remove: () => Promise<void> | void;
};

type NativeTabsBridge = {
  addListener: (
    eventName: "tabSelected",
    listenerFunc: (info: { tab: { route?: string | null } }) => void,
  ) => Promise<NativeListenerHandle>;
};

type CapacitorAppBridge = {
  addListener(
    eventName: "appUrlOpen",
    listenerFunc: (event: { url: string }) => void,
  ): Promise<NativeListenerHandle>;
  addListener(
    eventName: "backButton",
    listenerFunc: (event: { canGoBack: boolean }) => void | Promise<void>,
  ): Promise<NativeListenerHandle>;
};

type PushNotificationsBridge = {
  addListener: (
    eventName: "registration",
    listenerFunc: (token: { value: string }) => void | Promise<void>,
  ) => Promise<NativeListenerHandle>;
};

function isExamCookerLinkHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (EXAMCOOKER_LINK_HOSTS.has(normalized)) return true;
  if (typeof window === "undefined") return false;
  return normalized === window.location.hostname.toLowerCase();
}

function normalizeInternalPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized.replace(/^\/{2,}/, "/") || "/";
}

function resolveDeepLinkPath(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "examcooker:") {
      const host = parsed.hostname.toLowerCase();
      const hostPath = host && !isExamCookerLinkHost(host) ? `/${host}` : "";
      return normalizeInternalPath(`${hostPath}${parsed.pathname}${parsed.search}${parsed.hash}`);
    }

    if (parsed.protocol !== "https:" || !isExamCookerLinkHost(parsed.hostname)) return null;
    return normalizeInternalPath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return null;
  }
}

function navigateFromDeepLink(rawUrl: string, navigate: (path: string) => void) {
  const path = resolveDeepLinkPath(rawUrl);
  if (!path) return;
  if (path === window.location.pathname + window.location.search + window.location.hash) {
    return;
  }
  navigate(path);
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

function currentNativeTabTheme() {
  return isDarkTheme() ? "dark" : "light";
}

function currentLocationPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function observeNativeThemeAttributes(onChange: () => void) {
  let previousTheme = currentNativeTabTheme();
  const observer = new MutationObserver(() => {
    const nextTheme = currentNativeTabTheme();
    if (nextTheme === previousTheme) {
      return;
    }
    previousTheme = nextTheme;
    onChange();
  });
  observer.observe(document.documentElement, {
    attributeFilter: ["class", "data-theme", "style"],
  });

  return () => observer.disconnect();
}

function subscribeColorSchemeChange(
  colorSchemeQuery: MediaQueryList,
  onChange: () => void,
) {
  colorSchemeQuery.addEventListener("change", onChange);

  return () => {
    colorSchemeQuery.removeEventListener("change", onChange);
  };
}

function subscribeFirstPaintOnce(onPaint: () => void) {
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    onPaint();
  };

  if (typeof PerformanceObserver !== "undefined") {
    try {
      const observer = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          if (entry.name === "first-contentful-paint" || entry.entryType === "paint") {
            observer.disconnect();
            requestAnimationFrame(() => requestAnimationFrame(fire));
            return;
          }
        }
      });
      observer.observe({ type: "paint", buffered: true });
      const fallbackTimer = window.setTimeout(() => {
        observer.disconnect();
        fire();
      }, 1500);
      return () => {
        observer.disconnect();
        window.clearTimeout(fallbackTimer);
      };
    } catch {
      // fall through to load/RAF below
    }
  }

  const onDomReady = () => {
    requestAnimationFrame(() => requestAnimationFrame(fire));
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDomReady, { once: true });
  } else {
    onDomReady();
  }

  const fallbackTimer = window.setTimeout(fire, 1500);
  return () => {
    document.removeEventListener("DOMContentLoaded", onDomReady);
    window.clearTimeout(fallbackTimer);
  };
}

function normalizeNativeTabRoute(route: unknown) {
  if (typeof route !== "string" || route.length === 0) return "/";
  return route.startsWith("/") ? route : `/${route}`;
}

const NATIVE_PREFETCH_ROUTES = Array.from(
  new Set(APP_NAV_LINKS.map((link) => normalizeNativeTabRoute(link.href))),
);

function scheduleNativeRoutePrefetch(prefetch: (href: string) => void) {
  let cancelled = false;
  let timeoutId: number | undefined;

  const prefetchNext = (index: number) => {
    if (cancelled || index >= NATIVE_PREFETCH_ROUTES.length) {
      return;
    }

    try {
      prefetch(NATIVE_PREFETCH_ROUTES[index]);
    } catch {
      // ignore
    }

    timeoutId = window.setTimeout(() => prefetchNext(index + 1), 180);
  };

  const cancelIdlePrefetch = scheduleIdleWork(
    () => {
      prefetchNext(0);
    },
    {
      fallbackDelayMs: 1200,
      timeoutMs: 3500,
    },
  );

  return () => {
    cancelled = true;
    cancelIdlePrefetch();
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  };
}

async function sendNativePushToken(token: string, platform: string) {
  await fetch("/api/native/push-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform }),
  });
}

async function subscribeNativeTabSelection(
  nativeTabs: NativeTabsBridge,
  navigate: (path: string) => void,
) {
  const listener = await nativeTabs.addListener("tabSelected", (info) => {
    const route = info.tab.route ?? "/";
    const nextPath = route.startsWith("/") ? route : `/${route}`;
    if (nextPath === currentLocationPath()) return;
    navigate(nextPath);
  });

  return () => {
    void listener.remove();
  };
}

async function subscribeAppUrlOpen(
  app: CapacitorAppBridge,
  onOpen: (url: string) => void,
) {
  const listener = await app.addListener("appUrlOpen", (event) => {
    onOpen(event.url);
  });

  return () => {
    void listener.remove();
  };
}

async function subscribeAndroidBackButton(
  app: CapacitorAppBridge,
  onBack: (event: { canGoBack: boolean }) => void | Promise<void>,
) {
  const listener = await app.addListener("backButton", onBack);

  return () => {
    void listener.remove();
  };
}

async function subscribePushRegistration(
  pushNotifications: PushNotificationsBridge,
  onRegistration: (token: { value: string }) => void | Promise<void>,
) {
  const listener = await pushNotifications.addListener(
    "registration",
    onRegistration,
  );

  return () => {
    void listener.remove();
  };
}

export default function CapacitorBridge() {
  const { push, prefetch } = useRouter();
  const navigateToNativePath = useCallback(
    (path: string) => {
      startTransition(() => {
        push(path);
      });
    },
    [push],
  );

  useEffect(() => {
    let cancelled = false;
    let cleanupStatusBar: (() => void) | undefined;
    let cleanupDeepLinks: (() => void) | undefined;
    let cleanupNativeBridge: (() => void) | undefined;
    let cleanupNativeTabs: (() => void) | undefined;
    let cleanupSplash: (() => void) | undefined;
    let cleanupPushNotifications: (() => void) | undefined;

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

      const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const cleanupStatusBarThemeObserver = observeNativeThemeAttributes(
        applyStatusBarAppearance,
      );
      const cleanupStatusBarColorScheme = subscribeColorSchemeChange(
        colorSchemeQuery,
        applyStatusBarAppearance,
      );
      cleanupStatusBar = () => {
        cleanupStatusBarThemeObserver();
        cleanupStatusBarColorScheme();
      };

      if (platform === "ios" || platform === "android") {
        try {
          const { NativeTabs } = await import("capacitor-native-tab");
          const tabs = buildIosNativeTabConfigs(currentNativeTabTheme());
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
          document.documentElement.removeAttribute("data-native-tabs-pending");
          document.documentElement.removeAttribute("data-native-ios-tabs-pending");
          document.documentElement.removeAttribute("data-native-android-tabs-pending");
          cleanupNativeTabs = await subscribeNativeTabSelection(
            NativeTabs,
            navigateToNativePath,
          );
          let nativeTabsTheme = currentNativeTabTheme();
          const updateNativeTabsTheme = () => {
            const nextTheme = currentNativeTabTheme();
            if (nextTheme === nativeTabsTheme) {
              return;
            }
            nativeTabsTheme = nextTheme;
            void NativeTabs.updateTabs({
              tabs: buildIosNativeTabConfigs(nextTheme),
              theme: nextTheme,
            } as Parameters<typeof NativeTabs.updateTabs>[0] & { theme: "dark" | "light" }).catch(
              () => undefined,
            );
          };
          const cleanupNativeTabsThemeObserver = observeNativeThemeAttributes(
            updateNativeTabsTheme,
          );
          const cleanupNativeTabsColorScheme = subscribeColorSchemeChange(
            colorSchemeQuery,
            updateNativeTabsTheme,
          );
          const cleanupExistingNativeTabs = cleanupNativeTabs;
          cleanupNativeTabs = () => {
            cleanupExistingNativeTabs();
            cleanupNativeTabsThemeObserver();
            cleanupNativeTabsColorScheme();
          };
          await NativeTabs.showTabBar().catch(() => undefined);
        } catch {
          document.documentElement.removeAttribute("data-native-tabs");
          document.documentElement.removeAttribute("data-native-ios-tabs");
          document.documentElement.removeAttribute("data-native-android-tabs");
          document.documentElement.removeAttribute("data-native-tabs-pending");
          document.documentElement.removeAttribute("data-native-ios-tabs-pending");
          document.documentElement.removeAttribute("data-native-android-tabs-pending");
          window.dispatchEvent(new Event("examcooker:use-web-tab-bar"));
        }
      }

      const launchUrl = await App.getLaunchUrl().catch(() => ({ url: "" }));
      if (launchUrl?.url) {
        navigateFromDeepLink(launchUrl.url, navigateToNativePath);
      }

      cleanupDeepLinks = await subscribeAppUrlOpen(App, (url) => {
        if (url.startsWith("examcooker://native-auth/")) {
          void import("@capacitor/browser").then(({ Browser }) =>
            Browser.close().catch(() => undefined),
          );
        }
        navigateFromDeepLink(url, navigateToNativePath);
      });

      if (platform === "android") {
        cleanupNativeBridge = await subscribeAndroidBackButton(App, async ({ canGoBack }) => {
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
      }

      const hideSplash = () => {
        void SplashScreen.hide({ fadeOutDuration: 180 }).catch(() => undefined);
      };

      cleanupSplash = subscribeFirstPaintOnce(hideSplash);

      const cancelIdlePrefetch = scheduleNativeRoutePrefetch(prefetch);
      const cleanupExistingSplash = cleanupSplash;
      cleanupSplash = () => {
        cleanupExistingSplash?.();
        cancelIdlePrefetch();
      };

      if (
        process.env.NEXT_PUBLIC_ENABLE_NATIVE_PUSH === "1" ||
        process.env.NEXT_PUBLIC_ENABLE_NATIVE_PUSH === "true"
      ) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const [, cleanupPushRegistration] = await Promise.all([
          PushNotifications.requestPermissions().catch(() => undefined),
          subscribePushRegistration(PushNotifications, async (token) => {
            try {
              await sendNativePushToken(token.value, Capacitor.getPlatform());
            } catch {
              // non-blocking
            }
          }),
        ]);
        cleanupPushNotifications = cleanupPushRegistration;
        await PushNotifications.register().catch(() => undefined);
      }
    })();

    return () => {
      cancelled = true;
      cleanupStatusBar?.();
      cleanupDeepLinks?.();
      cleanupNativeBridge?.();
      cleanupNativeTabs?.();
      cleanupSplash?.();
      cleanupPushNotifications?.();
      const root = document.documentElement;
      delete root.dataset.nativePlatform;
      root.removeAttribute("data-native-tabs");
      root.removeAttribute("data-native-android");
      root.removeAttribute("data-native-ios");
      root.removeAttribute("data-native-ios-tabs");
      root.removeAttribute("data-native-android-tabs");
      root.removeAttribute("data-native-tabs-pending");
      root.removeAttribute("data-native-ios-tabs-pending");
      root.removeAttribute("data-native-android-tabs-pending");
    };
  }, [navigateToNativePath, prefetch]);

  return null;
}
