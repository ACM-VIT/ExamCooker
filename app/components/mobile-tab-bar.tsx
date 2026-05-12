"use client";

import Link from "next/link";
import Image from "@/app/components/common/app-image";
import { usePathname, useRouter } from "next/navigation";
import { addTransitionType, startTransition, useEffect, useReducer, type MouseEvent } from "react";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";

type Props = {
  toolsSheetOpen?: boolean;
};

type MobileTabBarState = {
  keyboardOpen: boolean;
  mode: "web" | "hidden";
  nativeAndroid: boolean;
};

type MobileTabBarAction =
  | { type: "web" }
  | { type: "hidden" }
  | { type: "android" }
  | { type: "keyboard"; open: boolean };

function mobileTabBarReducer(
  state: MobileTabBarState,
  action: MobileTabBarAction,
): MobileTabBarState {
  switch (action.type) {
    case "web":
      return { ...state, mode: "web" };
    case "hidden":
      return { ...state, mode: "hidden" };
    case "android":
      return { ...state, nativeAndroid: true };
    case "keyboard":
      return { ...state, keyboardOpen: action.open };
  }
}

function subscribeToWebTabBarFallback(onFallback: () => void) {
  window.addEventListener("examcooker:use-web-tab-bar", onFallback, { once: true });
  const timeoutId = window.setTimeout(onFallback, 1200);

  return () => {
    window.clearTimeout(timeoutId);
    window.removeEventListener("examcooker:use-web-tab-bar", onFallback);
  };
}

export default function MobileTabBar({ toolsSheetOpen = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [{ keyboardOpen, mode, nativeAndroid }, dispatch] = useReducer(
    mobileTabBarReducer,
    {
      keyboardOpen: false,
      mode: "web",
      nativeAndroid: false,
    },
  );

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
    let cleanupNativeTabProbe: (() => void) | undefined;

    void import("@capacitor/core").then(({ Capacitor }) => {
      if (cancelled) return;
      if (!Capacitor.isNativePlatform()) {
        dispatch({ type: "web" });
        return;
      }

      const platform = Capacitor.getPlatform();
      if (platform === "android") {
        dispatch({ type: "android" });
      }

      if (platform !== "ios" && platform !== "android") {
        dispatch({ type: "web" });
        return;
      }

      dispatch({ type: "hidden" });

      const failOpen = () => {
        if (!cancelled) dispatch({ type: "web" });
      };

      cleanupNativeTabProbe = subscribeToWebTabBarFallback(failOpen);

      if (document.documentElement.hasAttribute("data-native-tabs")) {
        cleanupNativeTabProbe();
        dispatch({ type: "hidden" });
        return;
      }

      const observer = new MutationObserver(() => {
        if (!document.documentElement.hasAttribute("data-native-tabs")) return;
        cleanupNativeTabProbe?.();
        if (!cancelled) dispatch({ type: "hidden" });
        observer.disconnect();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-native-tabs"],
      });
      const cleanupProbe = cleanupNativeTabProbe;
      cleanupNativeTabProbe = () => {
        cleanupProbe?.();
        observer.disconnect();
      };
    });

    return () => {
      cancelled = true;
      cleanupNativeTabProbe?.();
    };
  }, []);

  useEffect(() => {
    if (!nativeAndroid || typeof window === "undefined") {
      dispatch({ type: "keyboard", open: false });
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const syncKeyboardState = () => {
      const keyboardInset = window.innerHeight - viewport.height - viewport.offsetTop;
      dispatch({ type: "keyboard", open: keyboardInset > 140 });
    };

    syncKeyboardState();
    viewport.addEventListener("resize", syncKeyboardState);
    viewport.addEventListener("scroll", syncKeyboardState, { passive: true });

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

  return (
    <nav
      aria-label="Primary"
      style={{ viewTransitionName: "persistent-mobile-tab-bar" }}
      className={`ec-mobile-tab-bar fixed inset-x-0 bottom-0 z-[48] pb-[max(env(safe-area-inset-bottom),0px)] backdrop-blur-md transition-transform duration-200 lg:hidden ${
        nativeAndroid
          ? `border-t border-black/8 bg-white/96 shadow-[0_-10px_24px_rgba(15,23,42,0.10)] supports-[backdrop-filter]:bg-white/90 dark:border-[#D5D5D5]/10 dark:bg-[#09101E]/96 dark:shadow-[0_-16px_32px_rgba(0,0,0,0.45)] dark:supports-[backdrop-filter]:bg-[#09101E]/90 ${
              keyboardOpen ? "translate-y-[calc(100%+env(safe-area-inset-bottom)+12px)]" : "translate-y-0"
            }`
          : "border-t border-black/10 bg-[#C2E6EC]/95 supports-[backdrop-filter]:bg-[#C2E6EC]/85 dark:border-[#D5D5D5]/12 dark:bg-[#0C1222]/95 dark:supports-[backdrop-filter]:bg-[#0C1222]/88"
      }`}
    >
      <ul
        className={`ec-tab-bar-frame mx-auto flex max-w-lg items-stretch justify-between ${
          nativeAndroid ? "gap-0 px-2 py-2" : "gap-1 px-1 pt-1"
        }`}
      >
        <span
          aria-hidden
          className="ec-tab-pill"
          data-variant={nativeAndroid ? "android" : "web"}
        />
        {APP_NAV_LINKS.map((link) => {
          const isActive = link.matches
            ? link.matches(pathname)
            : pathname === link.href;
          return (
            <li key={link.href} className="relative z-[1] min-w-0 flex-1">
              <Link
                href={link.href}
                prefetch
                transitionTypes={isActive ? undefined : ["nav-lateral"]}
                onClickCapture={(event) => setNavTransitionOrigin(event.currentTarget)}
                onClick={(event) => handleTabClick(event, link.href, isActive)}
                className={`flex flex-col items-center rounded-xl font-semibold leading-tight tracking-tight transition-[color,transform] active:scale-[0.98] ${
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
                  data-variant={nativeAndroid ? "android" : "web"}
                  className={`relative z-[1] flex items-center justify-center ${
                    isActive ? "ec-tab-anchor-active" : ""
                  } ${
                    nativeAndroid
                      ? "h-8 min-w-[3.5rem] rounded-full px-3"
                      : "h-10 w-10 rounded-xl"
                  }`}
                >
                  <Image
                    src={link.svgSource}
                    alt=""
                    width={22}
                    height={22}
                    className={`shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:invert-[.835] ${
                      nativeAndroid ? "h-6 w-6" : "h-[22px] w-[22px]"
                    } ${isActive ? "scale-[1.08] opacity-100" : "opacity-85"}`}
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
