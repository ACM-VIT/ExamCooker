"use client";

import Link from "next/link";
import Image from "@/app/components/common/app-image";
import { usePathname, useRouter } from "next/navigation";
import { addTransitionType, startTransition, useEffect, useState, type MouseEvent } from "react";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";

type Props = {
  toolsSheetOpen?: boolean;
};

export default function MobileTabBar({ toolsSheetOpen = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<"unknown" | "web" | "hidden">("unknown");

  const setNavTransitionOrigin = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    document.documentElement.style.setProperty(
      "--nav-vt-x",
      `${rect.left + rect.width / 2}px`,
    );
    document.documentElement.style.setProperty(
      "--nav-vt-y",
      `${rect.top + rect.height / 2}px`,
    );
  };

  const handleTabClick = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    isActive: boolean,
  ) => {
    if (
      isActive ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    setNavTransitionOrigin(event.currentTarget);
    startTransition(() => {
      addTransitionType("nav-lateral");
      router.push(href);
    });
  };

  useEffect(() => {
    let cancelled = false;

    void import("@capacitor/core").then(({ Capacitor }) => {
      if (cancelled) return;
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
        setMode("web");
        return;
      }

      setMode("hidden");

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

  if (toolsSheetOpen) {
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
      style={{ viewTransitionName: "persistent-mobile-tab-bar" }}
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
                transitionTypes={isActive ? undefined : ["nav-lateral"]}
                onClickCapture={(event) => setNavTransitionOrigin(event.currentTarget)}
                onClick={(event) => handleTabClick(event, link.href, isActive)}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold leading-tight tracking-tight transition-colors active:scale-[0.98] sm:text-[12px] ${
                  isActive
                    ? "text-black dark:text-[#3BF4C7]"
                    : "text-black/55 dark:text-[#D5D5D5]/55"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                    isActive ? "bg-black/[0.06] dark:bg-white/[0.07]" : ""
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
