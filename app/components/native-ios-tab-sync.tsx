"use client";

import { addTransitionType, startTransition, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";

function activeTabIndex(pathname: string | null): number {
  const idx = APP_NAV_LINKS.findIndex((link) =>
    link.matches ? link.matches(pathname) : pathname === link.href,
  );
  return idx >= 0 ? idx : 0;
}

export default function NativeIosTabSync() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleRoute = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const path = event.detail?.path;
      if (typeof path !== "string" || !path.startsWith("/")) return;
      document.documentElement.style.setProperty("--nav-vt-x", "50vw");
      document.documentElement.style.setProperty(
        "--nav-vt-y",
        "calc(100vh - max(2.125rem, env(safe-area-inset-bottom)))",
      );
      startTransition(() => {
        addTransitionType("nav-lateral");
        router.push(path);
      });
    };

    window.addEventListener("examcooker:native-tab-route", handleRoute);
    return () => window.removeEventListener("examcooker:native-tab-route", handleRoute);
  }, [router]);

  useEffect(() => {
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;

        const { NativeTabs } = await import("capacitor-native-tabs");
        await NativeTabs.setSelectedTab({ index: activeTabIndex(pathname) }).catch(() => undefined);
      } catch {
      }
    })();
  }, [pathname]);

  return null;
}
