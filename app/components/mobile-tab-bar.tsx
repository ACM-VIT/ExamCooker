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
  const [nativeAndroid, setNativeAndroid] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

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
      if (!Capacitor.isNativePlatform()) {
        setMode("web");
        return;
      }

      const platform = Capacitor.getPlatform();
      if (platform === "android") {
        setNativeAndroid(true);
      }

      if (platform !== "ios" && platform !== "android") {
        setMode("web");
        return;
      }

      setMode("hidden");

      const failOpen = () => {
        if (!cancelled) setMode("web");
      };

      window.addEventListener("examcooker:use-web-tab-bar", failOpen, { once: true });
      const timeoutId = window.setTimeout(failOpen, 1200);

      if (document.documentElement.hasAttribute("data-native-tabs")) {
        window.clearTimeout(timeoutId);
        window.removeEventListener("examcooker:use-web-tab-bar", failOpen);
        setMode("hidden");
        return;
      }

      const observer = new MutationObserver(() => {
        if (!document.documentElement.hasAttribute("data-native-tabs")) return;
        window.clearTimeout(timeoutId);
        window.removeEventListener("examcooker:use-web-tab-bar", failOpen);
        if (!cancelled) setMode("hidden");
        observer.disconnect();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-native-tabs"],
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!nativeAndroid || typeof window === "undefined") {
      setKeyboardOpen(false);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const syncKeyboardState = () => {
      const keyboardInset = window.innerHeight - viewport.height - viewport.offsetTop;
      setKeyboardOpen(keyboardInset > 140);
    };

    syncKeyboardState();
    viewport.addEventListener("resize", syncKeyboardState);
    viewport.addEventListener("scroll", syncKeyboardState);

    return () => {
      viewport.removeEventListener("resize", syncKeyboardState);
      viewport.removeEventListener("scroll", syncKeyboardState);
    };
  }, [nativeAndroid]);

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
      className={`fixed inset-x-0 bottom-0 z-[48] pb-[max(env(safe-area-inset-bottom),0px)] backdrop-blur-md transition-transform duration-200 lg:hidden ${
        nativeAndroid
          ? `border-t border-black/8 bg-white/96 shadow-[0_-10px_24px_rgba(15,23,42,0.10)] supports-[backdrop-filter]:bg-white/90 dark:border-[#D5D5D5]/10 dark:bg-[#09101E]/96 dark:shadow-[0_-16px_32px_rgba(0,0,0,0.45)] dark:supports-[backdrop-filter]:bg-[#09101E]/90 ${
              keyboardOpen ? "translate-y-[calc(100%+env(safe-area-inset-bottom)+12px)]" : "translate-y-0"
            }`
          : "border-t border-black/10 bg-[#C2E6EC]/95 supports-[backdrop-filter]:bg-[#C2E6EC]/85 dark:border-[#D5D5D5]/12 dark:bg-[#0C1222]/95 dark:supports-[backdrop-filter]:bg-[#0C1222]/88"
      }`}
    >
      <ul
        className={`mx-auto flex max-w-lg items-stretch justify-between ${
          nativeAndroid ? "gap-0 px-2 py-2" : "gap-1 px-1 pt-1"
        }`}
      >
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
                className={`flex flex-col items-center rounded-xl font-semibold leading-tight tracking-tight transition-[background-color,color,transform] active:scale-[0.98] ${
                  nativeAndroid
                    ? `gap-1 px-1 py-1 text-[11px] ${
                        isActive
                          ? "text-[#0D5875] dark:text-[#3BF4C7]"
                          : "text-slate-500 dark:text-slate-400"
                      }`
                    : `gap-0.5 px-1 py-1.5 text-[11px] sm:text-[12px] ${
                        isActive
                          ? "text-black dark:text-[#3BF4C7]"
                          : "text-black/55 dark:text-[#D5D5D5]/55"
                      }`
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`flex items-center justify-center transition-colors ${
                    nativeAndroid
                      ? `h-8 min-w-[3.5rem] rounded-full px-3 ${
                          isActive
                            ? "bg-[#D6EEF5] dark:bg-[#113446]"
                            : "bg-transparent"
                        }`
                      : `h-10 w-10 rounded-xl ${isActive ? "bg-black/[0.06] dark:bg-white/[0.07]" : ""}`
                  }`}
                >
                  <Image
                    src={link.svgSource}
                    alt=""
                    width={22}
                    height={22}
                    className={`shrink-0 dark:invert-[.835] ${
                      nativeAndroid ? "h-6 w-6" : "h-[22px] w-[22px]"
                    } ${isActive ? "opacity-100" : "opacity-85"}`}
                  />
                </span>
                <span className={`max-w-full truncate ${nativeAndroid ? "text-[12px]" : ""}`}>
                  {link.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
