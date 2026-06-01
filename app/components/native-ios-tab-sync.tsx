"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";

function activeTabIndex(pathname: string | null): number {
  const idx = APP_NAV_LINKS.findIndex((link) =>
    link.matches ? link.matches(pathname) : pathname === link.href,
  );
  return idx >= 0 ? idx : 0;
}

export default function NativeIosTabSync() {
  const pathname = usePathname();

  useEffect(() => {
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const platform = Capacitor.getPlatform();
        if (platform !== "ios" && platform !== "android") return;

        const { NativeTabs } = await import("capacitor-native-tab");
        await NativeTabs.setSelectedTab({ index: activeTabIndex(pathname) }).catch(() => undefined);
      } catch {
      }
    })();
  }, [pathname]);

  return null;
}
