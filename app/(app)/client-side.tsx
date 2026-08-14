"use client";
import React, { Suspense, useCallback, useEffect, useEffectEvent, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import NavBar from "@/app/components/nav-bar";
import { usePathname } from "next/navigation";
import AppImage from "@/app/components/common/app-image";
import ExamCookerLogoIcon from "@/public/assets/logo-icon.svg";
import { markRenderedRoutePath } from "@/app/components/voice/voice-navigation";
import MobileTabBar from "@/app/components/mobile-tab-bar";
import { useLocationSearch } from "@/app/components/common/use-location-search";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";
import { MoreHorizontal, X } from "lucide-react";
import {
    PaperSplitViewProvider,
    usePaperSplitView,
} from "@/app/components/past_papers/paper-split-view";
import { POSTHOG_FEATURE_FLAGS } from "@/lib/posthog/shared";
import { usePostHogFeatureFlagEnabled } from "@/lib/posthog/use-feature-flag-enabled";
import C2CSakuraSignal from "@/app/components/c2c-sakura-signal";

const CommandPalette = dynamic(() => import("@/app/components/command-palette"), {
    ssr: false,
});

function RouteEffects({ onPathChange }: { onPathChange: () => void }) {
    const pathname = usePathname();
    const handlePathChange = useEffectEvent(() => {
        onPathChange();
    });

    useEffect(() => {
        handlePathChange();
    }, [pathname]);

    return null;
}

function RenderedRouteBeacon() {
    const pathname = usePathname() ?? "";
    const search = useLocationSearch();
    const routePath = `${pathname}${search}`;

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

    return !isHome && !hasPastPapersBreadcrumbBar && !hasSyllabusBreadcrumbBar && !hasNoteOrPaperBar;
}

function MobileStaticLogo() {
    const pathname = usePathname();
    const { activePaper, isSupported } = usePaperSplitView();

    if ((activePaper && isSupported) || !shouldShowMobileLogo(pathname)) return null;

    return (
        <div className="mobile-static-logo mx-auto flex w-full max-w-7xl px-3 lg:hidden">
            <Link
                href="/"
                aria-label="ExamCooker home"
                className="inline-flex h-11 max-w-full min-w-0 items-center gap-2 bg-transparent text-[15px] font-semibold leading-none text-black shadow-none dark:text-[#D5D5D5]"
            >
                <AppImage
                    src={ExamCookerLogoIcon}
                    alt="ExamCooker"
                    width={20}
                    height={20}
                    className="size-5 shrink-0"
                />
                <span className="truncate pt-px">
                    Exam
                    <span className="bg-gradient-to-tr from-[#253EE0] to-[#27BAEC] bg-clip-text text-transparent">
                        Cooker
                    </span>
                </span>
            </Link>
        </div>
    );
}

function MobileChromeHeader({
    isNavOn,
    toggleNavbar,
}: {
    isNavOn: boolean;
    toggleNavbar: () => void;
}) {
    return (
        <header className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[calc(3.25rem+env(safe-area-inset-top))] translate-y-0 transform-none lg:hidden">
            <div
                className="pointer-events-none flex h-full items-start gap-2 pt-[env(safe-area-inset-top)] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
            >
                <div className="min-h-11 min-w-0 flex-1" aria-hidden />
                <button
                    type="button"
                    onClick={toggleNavbar}
                    aria-label={isNavOn ? "Close tools menu" : "Open tools menu"}
                    aria-expanded={isNavOn}
                    style={{ viewTransitionName: "persistent-menu-button" }}
                    className={`ec-icon-button pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-black/65 active:bg-black/[0.08] dark:text-[#D5D5D5]/85 dark:active:bg-white/[0.07] ${isNavOn ? "pointer-events-none opacity-0" : "opacity-100"}`}
                >
                    <MoreHorizontal className="size-6" strokeWidth={2.25} aria-hidden />
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
                                className="flex size-10 items-center justify-center rounded-full text-black/50 hover:bg-black/[0.07] dark:text-[#D5D5D5]/55 dark:hover:bg-white/[0.08]"
                            >
                                <X className="size-5" aria-hidden />
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
    commandPaletteOpen,
    setCommandPaletteOpen,
}: {
    children: React.ReactNode;
    isNavOn: boolean;
    toggleNavbar: () => void;
    commandPaletteOpen: boolean;
    setCommandPaletteOpen: (open: boolean) => void;
}) {
    const commandPaletteEnabled =
        usePostHogFeatureFlagEnabled(POSTHOG_FEATURE_FLAGS.commandPalette) ?? false;
    const closeCommandPalette = useEffectEvent(() => {
        setCommandPaletteOpen(false);
    });

    useEffect(() => {
        if (!commandPaletteEnabled && commandPaletteOpen) {
            closeCommandPalette();
        }
    }, [commandPaletteEnabled, commandPaletteOpen]);

    const openCommandPalette = useCallback(() => {
        if (commandPaletteEnabled) {
            setCommandPaletteOpen(true);
        }
    }, [commandPaletteEnabled, setCommandPaletteOpen]);

    return (
        <Suspense fallback={<div className="relative flex" />}>
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
                    <NavBar
                        isNavOn={isNavOn}
                        toggleNavbar={toggleNavbar}
                        commandPaletteEnabled={commandPaletteEnabled}
                        onOpenCommandPalette={openCommandPalette}
                    />
                </Suspense>
                {commandPaletteEnabled ? (
                    <CommandPalette
                        open={commandPaletteOpen}
                        onOpenChange={setCommandPaletteOpen}
                    />
                ) : null}
                <main className="ec-app-main min-w-0 flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] lg:pb-0 lg:pl-14 lg:pt-0">
                    <C2CSakuraSignal />
                    <PaperSplitViewProvider>
                        <Suspense fallback={null}>
                            <MobileStaticLogo />
                        </Suspense>
                        {children}
                    </PaperSplitViewProvider>
                </main>
                <Suspense fallback={null}>
                    <MobileTabBar toolsSheetOpen={isNavOn} />
                </Suspense>
            </div>
        </Suspense>
    );
}

export default function ClientSide({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isNavOn, setIsNavOn] = useState(false);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const desktop = window.matchMedia("(min-width: 1024px)");
        const sync = () => setIsNavOn(desktop.matches);
        sync();
        desktop.addEventListener("change", sync);
        return () => desktop.removeEventListener("change", sync);
    }, []);

    useEffect(() => {
        const handleNativeBack = (event: Event) => {
            if (!isNavOn) return;
            event.preventDefault();
            setIsNavOn(false);
        };

        window.addEventListener("examcooker:native-back", handleNativeBack);
        return () => window.removeEventListener("examcooker:native-back", handleNativeBack);
    }, [isNavOn]);

    const handlePathChange = useCallback(() => {
        if (typeof window === "undefined") return;
        if (!window.matchMedia("(min-width: 1024px)").matches) {
            setIsNavOn(false);
        }
    }, []);

    const toggleNavbar = useCallback(() => setIsNavOn((v) => !v), []);

    return (
        <ClientShell
            isNavOn={isNavOn}
            toggleNavbar={toggleNavbar}
            commandPaletteOpen={commandPaletteOpen}
            setCommandPaletteOpen={setCommandPaletteOpen}
        >
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
