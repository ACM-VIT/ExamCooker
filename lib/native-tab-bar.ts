"use client";

import { useEffect } from "react";

// The Capacitor shell draws its tab bar natively above the WebView, so web
// sheets cannot cover it with z-index. Sheets hide it while open instead; the
// count keeps one sheet closing from revealing the bar under another.
let hideRequests = 0;

async function setNativeTabBarHidden(hidden: boolean) {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const platform = Capacitor.getPlatform();
    if (platform !== "ios" && platform !== "android") return;
    const { NativeTabs } = await import("capacitor-native-tab");
    if (hidden) {
      await NativeTabs.hideTabBar().catch(() => undefined);
    } else {
      await NativeTabs.showTabBar().catch(() => undefined);
    }
  } catch {
    // Plugin unavailable outside Capacitor native shells
  }
}

export function useHideNativeTabBar(hidden: boolean) {
  useEffect(() => {
    if (!hidden) return;
    hideRequests += 1;
    if (hideRequests === 1) void setNativeTabBarHidden(true);
    return () => {
      hideRequests -= 1;
      if (hideRequests === 0) void setNativeTabBarHidden(false);
    };
  }, [hidden]);
}
