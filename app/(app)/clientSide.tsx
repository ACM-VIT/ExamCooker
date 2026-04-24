"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/app/components/NavBar";
import BookmarksProvider from "@/app/components/BookmarksProvider";
import GuestPromptProvider from "@/app/components/GuestPromptProvider";
import type { Bookmark } from "@/app/actions/Favourites";
import { usePathname } from "next/navigation";
import AppImage from "@/app/components/common/AppImage";
import ExamCookerLogoIcon from "@/public/assets/LogoIcon.svg";

export default function ClientSide({
    children,
    initialBookmarks,
}: {
    children: React.ReactNode;
    initialBookmarks: Bookmark[];
}) {
    const pathname = usePathname();
    const [isNavOn, setIsNavOn] = useState(false);
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

    useEffect(() => {
        if (typeof window === "undefined") return;
        const desktop = window.matchMedia("(min-width: 1024px)");
        const sync = () => setIsNavOn(desktop.matches);
        sync();
        desktop.addEventListener("change", sync);
        return () => desktop.removeEventListener("change", sync);
    }, []);

    // Close mobile drawer on route change
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!window.matchMedia("(min-width: 1024px)").matches) {
            setIsNavOn(false);
        }
    }, [pathname]);

    const toggleNavbar = () => setIsNavOn((v) => !v);

    return (
        <GuestPromptProvider>
            <BookmarksProvider initialBookmarks={initialBookmarks}>
                <div className="relative flex">
                    <NavBar isNavOn={isNavOn} toggleNavbar={toggleNavbar} />
                    {showMobileLogo && (
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
                    )}
                    <main className="min-w-0 flex-1 pt-14 lg:pt-0 lg:pl-14">
                        {children}
                    </main>
                </div>
            </BookmarksProvider>
        </GuestPromptProvider>
    );
}
