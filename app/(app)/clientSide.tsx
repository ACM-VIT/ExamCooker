"use client";
import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/app/components/NavBar";
import BookmarksProvider from "@/app/components/BookmarksProvider";
import GuestPromptProvider from "@/app/components/GuestPromptProvider";
import type { Bookmark } from "@/app/actions/Favourites";
import { usePathname } from "next/navigation";
import AppImage from "@/app/components/common/AppImage";
import ExamCookerLogoIcon from "@/public/assets/LogoIcon.svg";

const NAV_LINKS = [
    { href: "/", label: "Home" },
    { href: "/past_papers", label: "Papers" },
    { href: "/notes", label: "Notes" },
    { href: "/syllabus", label: "Syllabus" },
    { href: "/resources", label: "Resources" },
    { href: "/quiz", label: "Quiz" },
] as const;

function RouteEffects({ onPathChange }: { onPathChange: () => void }) {
    const pathname = usePathname();

    useEffect(() => {
        onPathChange();
    }, [onPathChange, pathname]);

    return null;
}

function MobileLogoLink() {
    const pathname = usePathname();
    const pathSegments = (pathname ?? "").split("/").filter(Boolean);
    const isHome = pathSegments.length === 0;
    const hasPastPapersBreadcrumbBar =
        pathSegments[0] === "past_papers" &&
        pathSegments[1] !== undefined &&
        pathSegments[1] !== "create" &&
        (pathSegments.length === 2 ||
            (pathSegments.length === 3 && pathSegments[2] !== "paper"));
    const hasSyllabusBreadcrumbBar =
        pathSegments[0] === "syllabus" &&
        pathSegments[1] === "course" &&
        pathSegments[2] !== undefined;
    const hasBreadcrumbBar = hasPastPapersBreadcrumbBar || hasSyllabusBreadcrumbBar;
    const showMobileLogo = !hasBreadcrumbBar && !isHome;

    if (!showMobileLogo) return null;

    return (
        <Link
            href="/"
            aria-label="ExamCooker home"
            style={{ viewTransitionName: "persistent-mobile-logo" }}
            className="fixed left-16 top-3 z-[55] flex h-11 max-w-[calc(100vw-5.5rem)] items-center gap-2.5 rounded-xl border border-black/10 bg-white/90 px-3.5 text-[15px] font-semibold leading-none text-black shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur transition-colors hover:border-black/25 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]/90 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/50 lg:hidden"
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

function NavBarFallback({
    isNavOn,
    toggleNavbar,
}: {
    isNavOn: boolean;
    toggleNavbar: () => void;
}) {
    return (
        <>
            <button
                type="button"
                onClick={toggleNavbar}
                aria-label={isNavOn ? "Close navigation" : "Open navigation"}
                aria-expanded={isNavOn}
                style={{ viewTransitionName: "persistent-menu-button" }}
                className={`fixed top-3 left-3 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-black shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur transition-all duration-200 active:scale-95 hover:border-black/25 hover:bg-white hover:shadow-md dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]/90 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/40 dark:hover:bg-[#0C1222] lg:hidden ${isNavOn ? "pointer-events-none opacity-0" : "opacity-100"}`}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-5 w-5"
                >
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h10" />
                </svg>
            </button>

            <div
                onClick={toggleNavbar}
                aria-hidden="true"
                className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${isNavOn ? "opacity-100" : "pointer-events-none opacity-0"}`}
            />

            <nav
                style={{ viewTransitionName: "persistent-nav" }}
                className={`fixed top-0 left-0 z-50 h-dvh max-h-dvh w-fit overflow-visible border-r border-black/15 bg-[#C2E6EC] transition-transform duration-200 ease-out dark:border-r-[#D5D5D5]/15 dark:bg-[#0C1222] ${isNavOn ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
            >
                <div className="flex h-full max-h-dvh w-fit flex-col items-center justify-between overflow-y-auto overscroll-contain p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
                    <div className="flex w-full min-h-[2.5rem] items-center justify-start px-1">
                        <button
                            type="button"
                            onClick={toggleNavbar}
                            aria-label="Close navigation"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-black/60 transition-colors hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5] lg:hidden"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                                aria-hidden="true"
                            >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex flex-col items-center">
                        {NAV_LINKS.map((link) => (
                            <Link key={link.href} href={link.href} className="m-2 text-sm font-medium">
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    <div className="mb-2 h-8 w-8 rounded-full border border-black/15 bg-white dark:border-[#D5D5D5]/20 dark:bg-transparent" />
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
        <div className="relative flex">
            <Suspense fallback={<NavBarFallback isNavOn={isNavOn} toggleNavbar={toggleNavbar} />}>
                <NavBar isNavOn={isNavOn} toggleNavbar={toggleNavbar} />
            </Suspense>
            <Suspense fallback={null}>
                <MobileLogoLink />
            </Suspense>
            <main className="min-w-0 flex-1 pt-14 lg:pt-0 lg:pl-14">
                {children}
            </main>
        </div>
    );
}

function ClientProviders({
    children,
    initialBookmarks,
}: {
    children: React.ReactNode;
    initialBookmarks: Bookmark[];
}) {
    return (
        <GuestPromptProvider>
            <BookmarksProvider initialBookmarks={initialBookmarks}>
                {children}
            </BookmarksProvider>
        </GuestPromptProvider>
    );
}

export default function ClientSide({
    children,
    initialBookmarks,
}: {
    children: React.ReactNode;
    initialBookmarks: Bookmark[];
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
            <Suspense fallback={children}>
                <ClientProviders initialBookmarks={initialBookmarks}>
                    <Suspense fallback={null}>
                        <RouteEffects onPathChange={handlePathChange} />
                    </Suspense>
                    {children}
                </ClientProviders>
            </Suspense>
        </ClientShell>
    );
}
