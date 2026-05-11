"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { buildIosNativeTabConfigs } from "@/lib/ios-native-tab-config";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";

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
  const observer = new MutationObserver(onChange);
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

function subscribeWindowLoadOnce(onLoad: () => void) {
  window.addEventListener("load", onLoad, { once: true });

  return () => {
    window.removeEventListener("load", onLoad);
  };
}

function normalizeNativeTabRoute(route: unknown) {
  if (typeof route !== "string" || route.length === 0) return "/";
  return route.startsWith("/") ? route : `/${route}`;
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
  const router = useRouter();
  const navigateToNativePath = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router],
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
          const { NativeTabs } = await import("capacitor-native-tabs");
          const tabs = buildIosNativeTabConfigs(currentNativeTabTheme());
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
          document.documentElement.removeAttribute("data-native-tabs-pending");
          document.documentElement.removeAttribute("data-native-ios-tabs-pending");
          document.documentElement.removeAttribute("data-native-android-tabs-pending");
          cleanupNativeTabs = await subscribeNativeTabSelection(
            NativeTabs,
            navigateToNativePath,
          );
          const updateNativeTabsTheme = () => {
            void NativeTabs.updateTabs({
              tabs: buildIosNativeTabConfigs(currentNativeTabTheme()),
              theme: currentNativeTabTheme(),
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
        void SplashScreen.hide({ fadeOutDuration: 220 }).catch(() => undefined);
      };

      if (document.readyState === "complete") {
        hideSplash();
      } else {
        cleanupSplash = subscribeWindowLoadOnce(hideSplash);
      }

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
  }, [navigateToNativePath, router]);

  return null;
}
