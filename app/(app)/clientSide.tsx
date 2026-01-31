"use client";
import React, { useState, useEffect, useRef } from "react";
import NavBar from "@/app/components/NavBar";
import Header from "@/app/components/header";
import Image from "next/image";
import HomeFooter from "@/app/(app)/home/home_footer";
import BookmarksProvider from "@/app/components/BookmarksProvider";
import GuestPromptProvider from "@/app/components/GuestPromptProvider";
import type { Bookmark } from "@/app/actions/Favourites";

export default function ClientSide({
    children,
    initialBookmarks,
}: {
    children: React.ReactNode;
    initialBookmarks: Bookmark[];
}) {
    const [isNavOn, setIsNavOn] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const navbarRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const savedNavState = localStorage.getItem("isNavOn");
        const savedDarkMode = localStorage.getItem("darkMode");
        if (savedNavState !== null) {
            setIsNavOn(savedNavState === "true");
        }
        if (savedDarkMode !== null) {
            setDarkMode(savedDarkMode === "true");
        }
    }, []);

    const toggleNavbar = () => {
        setIsNavOn((prevState) => {
            const newState = !prevState;
            localStorage.setItem("isNavOn", newState.toString());
            return newState;
        });
    };

    const toggleTheme = () => {
        setDarkMode((prevState) => {
            const newState = !prevState;
            localStorage.setItem("darkMode", newState.toString());
            return newState;
        });
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (
            navbarRef.current &&
            !navbarRef.current.contains(event.target as Node)
        ) {
            setIsNavOn(false);
            localStorage.setItem("isNavOn", "false");
        }
    };

    useEffect(() => {
        if (isNavOn) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isNavOn]);

    return (
        <GuestPromptProvider>
            <BookmarksProvider initialBookmarks={initialBookmarks}>
                <div className={`relative flex`}>
                    {!isNavOn && (
                        <button
                            title="Open Navbar"
                            onClick={toggleNavbar}
                            className="absolute top-4 left-4 z-50 opacity-100"
                        >
                            <Image
                                src="/assets/HamburgerIcon.svg"
                                alt="Menu"
                                width={30}
                                height={30}
                                className="dark:invert-[.835] transition-transform transform-gpu hover:scale-110 hover:-translate-y-1"
                            />
                        </button>
                    )}
                    <div ref={navbarRef}>
                        <NavBar isNavOn={isNavOn} toggleNavbar={toggleNavbar} />
                    </div>
                    <main
                        className={`flex-grow transition-all duration-300 ease-in-out ${
                            isNavOn ? "lg:w-[95vw] md:w-[92vw]" : "w-[100vw]"
                        }`}
                    >
                        <div
                            className={`min-h-screen flex flex-col justify-between ${
                                darkMode ? "dark" : ""
                            }`}
                        >
                            <Header toggleTheme={toggleTheme} darkMode={darkMode} />
                            {children}
                            <HomeFooter />
                        </div>
                    </main>
                </div>
            </BookmarksProvider>
        </GuestPromptProvider>
    );
}
