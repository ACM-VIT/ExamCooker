"use client";
import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/app/components/nav-bar";
import { usePathname, useSearchParams } from "next/navigation";
import AppImage from "@/app/components/common/app-image";
import ExamCookerLogoIcon from "@/public/assets/logo-icon.svg";
import { markRenderedRoutePath } from "@/app/components/voice/voice-navigation";
import MobileTabBar from "@/app/components/mobile-tab-bar";
import NativeIosTabSync from "@/app/components/native-ios-tab-sync";
import { NavFromProvider } from "@/app/components/common/nav-from-provider";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";
import { canUseNativeChrome, setNativeChromeLogoVisible } from "@/lib/native-chrome";
import { MoreHorizontal, X } from "lucide-react";

function RouteEffects({ onPathChange }: { onPathChange: () => void }) {
    const pathname = usePathname();

    useEffect(() => {
        onPathChange();
    }, [onPathChange, pathname]);

    return null;
}

function RenderedRouteBeacon() {
    const pathname = usePathname() ?? "";
    const searchParams = useSearchParams();
    const search = searchParams.toString();
    const routePath = `${pathname}${search ? `?${search}` : ""}`;

    useEffect(() => {
        markRenderedRoutePath(routePath);
    }, [routePath]);

    return null;
}

function shouldShowMobileLogo(pathname: string | null) {
    const pathSegments = (pathname ?? "").split("/").filter(Boolean);
    const isHome = pathSegments.length === 0;
    const hasPastPapersBreadcrumbBar =
        pathSegments[0] === "past_papers" &&
        pathSegments.length >= 2 &&
        pathSegments[1] !== "create";
    const hasSyllabusBreadcrumbBar =
        pathSegments[0] === "syllabus" && pathSegments.length >= 2;
    const hasNoteOrPaperBar =
        (pathSegments[0] === "notes" && pathSegments[1] !== undefined) ||
        (pathSegments[0] === "resources" && pathSegments.length >= 2);
    const hasBreadcrumbBar =
        hasPastPapersBreadcrumbBar ||
        hasSyllabusBreadcrumbBar ||
        hasNoteOrPaperBar;

    return !hasBreadcrumbBar && !isHome;
}

function isDarkTheme() {
    const root = document.documentElement;
    if (root.dataset.theme === "dark") return true;
    if (root.dataset.theme === "light") return false;
    return root.classList.contains("dark");
}

function NativeChromeSync() {
    const pathname = usePathname();
    const showMobileLogo = shouldShowMobileLogo(pathname);

    useEffect(() => {
        if (!canUseNativeChrome()) return;

        let cancelled = false;
        let cleanupThemeListeners: (() => void) | undefined;
        document.documentElement.setAttribute("data-native-ios-chrome", "true");

        const sync = () => {
            void setNativeChromeLogoVisible({
                visible: showMobileLogo,
                darkMode: isDarkTheme(),
            }).catch(() => undefined);
        };

        sync();

        const themeObserver = new MutationObserver(() => {
            if (!cancelled) sync();
        });
        themeObserver.observe(document.documentElement, {
            attributeFilter: ["class", "data-theme", "style"],
        });

        const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleColorSchemeChange = () => {
            if (!cancelled) sync();
        };
        colorSchemeQuery.addEventListener("change", handleColorSchemeChange);
        cleanupThemeListeners = () => {
            themeObserver.disconnect();
            colorSchemeQuery.removeEventListener("change", handleColorSchemeChange);
        };

        return () => {
            cancelled = true;
            cleanupThemeListeners?.();
        };
    }, [showMobileLogo]);

    return null;
}

function MobileLogoLink() {
    const pathname = usePathname();
    const showMobileLogo = shouldShowMobileLogo(pathname);

    if (!showMobileLogo) return null;

    return (
        <Link
            href="/"
            aria-label="ExamCooker home"
            style={{ viewTransitionName: "persistent-mobile-logo" }}
            className="ec-web-mobile-logo pointer-events-auto relative flex h-11 max-w-full min-w-0 items-center gap-2.5 rounded-xl border border-black/10 bg-white/90 px-3 text-[15px] font-semibold leading-none text-black shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur transition-colors hover:border-black/25 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]/90 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/50"
        >
            <AppImage
                src={ExamCookerLogoIcon}
                alt="ExamCooker"
                width={20}
                height={20}
                className="h-5 w-5 shrink-0"
            />
            <span className="truncate pt-px">
                Exam
                <span className="bg-gradient-to-tr from-[#253EE0] to-[#27BAEC] bg-clip-text text-transparent">
                    Cooker
                </span>
            </span>
        </Link>
    );
}

/** One mobile row: safe-area insets + aligned logo + ⋯ menu (NavBar owns sheet + overlay). */
function MobileChromeHeader({
    isNavOn,
    toggleNavbar,
}: {
    isNavOn: boolean;
    toggleNavbar: () => void;
}) {
    return (
        <header className="pointer-events-none fixed inset-x-0 top-0 z-[60] lg:hidden">
            <div
                className="pointer-events-none flex items-center gap-2 pb-2 pt-[env(safe-area-inset-top)] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
            >
                <div className="flex min-h-11 min-w-0 flex-1 items-center justify-start">
                    <Suspense fallback={null}>
                        <MobileLogoLink />
                    </Suspense>
                </div>
                <button
                    type="button"
                    onClick={toggleNavbar}
                    aria-label={isNavOn ? "Close tools menu" : "Open tools menu"}
                    aria-expanded={isNavOn}
                    style={{ viewTransitionName: "persistent-menu-button" }}
                    className={`pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-black/65 transition-colors active:bg-black/[0.08] dark:text-[#D5D5D5]/85 dark:active:bg-white/[0.07] ${isNavOn ? "pointer-events-none opacity-0" : "opacity-100"}`}
                >
                    <MoreHorizontal className="h-6 w-6" strokeWidth={2.25} aria-hidden />
                </button>
            </div>
        </header>
    );
}

function NavBarFallback({
    isNavOn,
    toggleNavbar,
}: {
    isNavOn: boolean;
    toggleNavbar: () => void;
}) {
    return (
        <>
            <div
                onClick={toggleNavbar}
                aria-hidden="true"
                className={`fixed inset-0 z-[54] bg-black/65 backdrop-blur-[3px] transition-opacity duration-200 lg:hidden ${isNavOn ? "opacity-100" : "pointer-events-none opacity-0"}`}
            />

            <nav
                style={{ viewTransitionName: "persistent-nav" }}
                className={`fixed z-[55] overflow-hidden border-black/15 bg-[#C2E6EC] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] ${isNavOn ? "translate-y-0" : "translate-y-[calc(100%+16px)]"} inset-x-0 bottom-0 max-h-[min(520px,88dvh)] w-full rounded-t-[1.35rem] border border-b-0 lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-0 lg:flex lg:h-dvh lg:max-h-dvh lg:w-fit lg:translate-x-0 lg:translate-y-0 lg:rounded-none lg:border lg:border-y-0 lg:border-l-0 lg:border-r`}
            >
                <div className="flex max-h-[min(520px,88dvh)] min-h-0 w-full flex-col overflow-y-auto overscroll-contain pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:h-full lg:max-h-dvh lg:w-fit lg:pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:pt-[max(0.5rem,env(safe-area-inset-top))]">
                    <div className="order-1 shrink-0 border-b border-black/10 px-4 pb-3 pt-3 dark:border-white/10 lg:hidden">
                        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/12 dark:bg-white/18" aria-hidden />
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[17px] font-semibold text-black dark:text-[#EAF6FF]">Tools</p>
                            <button
                                type="button"
                                onClick={toggleNavbar}
                                aria-label="Close tools menu"
                                className="flex h-10 w-10 items-center justify-center rounded-full text-black/50 hover:bg-black/[0.07] dark:text-[#D5D5D5]/55 dark:hover:bg-white/[0.08]"
                            >
                                <X className="h-5 w-5" aria-hidden />
                            </button>
                        </div>
                    </div>
                    <div className="hidden min-h-[2.5rem] lg:block" aria-hidden />
                    <div
                        className={
                            "order-3 hidden min-h-0 flex-1 flex-col items-center overflow-y-auto px-2 py-2 lg:order-2 lg:flex lg:justify-center lg:overflow-visible lg:px-1 lg:py-2"
                        }
                    >
                        {APP_NAV_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                transitionTypes={["nav-lateral"]}
                                className="m-2 text-sm font-medium"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </nav>
        </>
    );
}

function ClientShell({
    children,
    isNavOn,
    toggleNavbar,
}: {
    children: React.ReactNode;
    isNavOn: boolean;
    toggleNavbar: () => void;
}) {
    return (
        <Suspense fallback={<div className="relative flex" />}>
            <NavFromProvider>
                <div className="relative flex">
                    <MobileChromeHeader isNavOn={isNavOn} toggleNavbar={toggleNavbar} />
                    <Suspense
                        fallback={
                            <NavBarFallback
                                isNavOn={isNavOn}
                                toggleNavbar={toggleNavbar}
                            />
                        }
                    >
                        <NavBar isNavOn={isNavOn} toggleNavbar={toggleNavbar} />
                    </Suspense>
                    <main className="ec-app-main min-w-0 flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+3.25rem)] lg:pb-0 lg:pl-14 lg:pt-0">
                        {children}
                    </main>
                    <Suspense fallback={null}>
                        <MobileTabBar toolsSheetOpen={isNavOn} />
                    </Suspense>
                    <Suspense fallback={null}>
                        <NativeIosTabSync />
                    </Suspense>
                    <Suspense fallback={null}>
                        <NativeChromeSync />
                    </Suspense>
                </div>
            </NavFromProvider>
        </Suspense>
    );
}

export default function ClientSide({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isNavOn, setIsNavOn] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const desktop = window.matchMedia("(min-width: 1024px)");
        const sync = () => setIsNavOn(desktop.matches);
        sync();
        desktop.addEventListener("change", sync);
        return () => desktop.removeEventListener("change", sync);
    }, []);

    const handlePathChange = () => {
        if (typeof window === "undefined") return;
        if (!window.matchMedia("(min-width: 1024px)").matches) {
            setIsNavOn(false);
        }
    };

    const toggleNavbar = () => setIsNavOn((v) => !v);

    return (
        <ClientShell isNavOn={isNavOn} toggleNavbar={toggleNavbar}>
            <Suspense fallback={null}>
                <RouteEffects onPathChange={handlePathChange} />
            </Suspense>
            {children}
            <Suspense fallback={null}>
                <RenderedRouteBeacon />
            </Suspense>
        </ClientShell>
    );
}
