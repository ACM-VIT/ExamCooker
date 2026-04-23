"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/app/components/NavBar";
import HomeFooter from "@/app/(app)/home/home_footer";
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
                    {!hasBreadcrumbBar && (
                        <Link
                            href="/home"
                            aria-label="ExamCooker home"
                            className="fixed left-16 top-3 z-[55] flex h-10 max-w-[calc(100vw-5.5rem)] items-center gap-2 rounded-md border border-black/10 bg-white/90 px-3 text-sm font-semibold text-black backdrop-blur transition-colors hover:border-black/25 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]/90 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/50 lg:hidden"
                        >
                            <AppImage
                                src={ExamCookerLogoIcon}
                                alt="ExamCooker"
                                width={18}
                                height={18}
                                className="h-[18px] w-[18px] shrink-0"
                            />
                            <span className="truncate">
                                Exam
                                <span className="bg-gradient-to-tr from-[#253EE0] to-[#27BAEC] bg-clip-text text-transparent">
                                    Cooker
                                </span>
                            </span>
                        </Link>
                    )}
                    <main className="min-w-0 flex-1 pt-14 lg:pt-0 lg:pl-14">
                        <div className="flex min-h-screen min-w-0 flex-col">
                            <div className="min-h-0 flex-1">
                                {children}
                            </div>
                            <HomeFooter />
                        </div>
                    </main>
                </div>
            </BookmarksProvider>
        </GuestPromptProvider>
    );
}
