"use client";

import Link from "next/link";
import Image from "@/app/components/common/app-image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";

export default function MobileTabBar() {
  const pathname = usePathname();
  const [mode, setMode] = useState<"unknown" | "web" | "hidden">("unknown");

  useEffect(() => {
    let cancelled = false;

    void import("@capacitor/core").then(({ Capacitor }) => {
      if (cancelled) return;
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
        setMode("web");
        return;
      }

      const failOpen = () => {
        if (!cancelled) setMode("web");
      };

      window.addEventListener("examcooker:use-web-tab-bar", failOpen, { once: true });
      const timeoutId = window.setTimeout(failOpen, 1200);

      if (document.documentElement.hasAttribute("data-native-ios-tabs")) {
        window.clearTimeout(timeoutId);
        window.removeEventListener("examcooker:use-web-tab-bar", failOpen);
        setMode("hidden");
        return;
      }

      const observer = new MutationObserver(() => {
        if (!document.documentElement.hasAttribute("data-native-ios-tabs")) return;
        window.clearTimeout(timeoutId);
        window.removeEventListener("examcooker:use-web-tab-bar", failOpen);
        if (!cancelled) setMode("hidden");
        observer.disconnect();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-native-ios-tabs"],
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === "hidden") {
    return null;
  }

  if (mode !== "web") {
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-[48] min-h-[calc(4.25rem+env(safe-area-inset-bottom))] bg-transparent lg:hidden"
        aria-hidden
      />
    );
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-[48] border-t border-black/10 bg-[#C2E6EC]/95 pb-[max(env(safe-area-inset-bottom),0px)] backdrop-blur-md supports-[backdrop-filter]:bg-[#C2E6EC]/85 dark:border-[#D5D5D5]/12 dark:bg-[#0C1222]/95 dark:supports-[backdrop-filter]:bg-[#0C1222]/88 lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-1 px-1 pt-1">
        {APP_NAV_LINKS.map((link) => {
          const isActive = link.matches
            ? link.matches(pathname)
            : pathname === link.href;
          return (
            <li key={link.href} className="min-w-0 flex-1">
              <Link
                href={link.href}
                prefetch
                className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold leading-tight tracking-tight transition-colors active:scale-[0.98] sm:text-[12px] ${
                  isActive
                    ? "text-black dark:text-[#3BF4C7]"
                    : "text-black/55 dark:text-[#D5D5D5]/55"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                    isActive
                      ? "bg-white/90 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-white/[0.08] dark:shadow-none"
                      : ""
                  }`}
                >
                  <Image
                    src={link.svgSource}
                    alt=""
                    width={22}
                    height={22}
                    className={`h-[22px] w-[22px] shrink-0 dark:invert-[.835] ${
                      isActive ? "opacity-100" : "opacity-85"
                    }`}
                  />
                </span>
                <span className="max-w-full truncate">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
