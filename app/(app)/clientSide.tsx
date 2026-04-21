"use client";
import React, { useState, useEffect } from "react";
import NavBar from "@/app/components/NavBar";
import Header from "@/app/components/header";
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
    const [isNavOn, setIsNavOn] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const savedDarkMode = localStorage.getItem("darkMode");
        if (savedDarkMode !== null) {
            setDarkMode(savedDarkMode === "true");
        }
    }, []);

    const toggleNavbar = () => {
        setIsNavOn((prevState) => !prevState);
    };

    const toggleTheme = () => {
        setDarkMode((prevState) => {
            const newState = !prevState;
            localStorage.setItem("darkMode", newState.toString());
            return newState;
        });
    };

    return (
        <GuestPromptProvider>
            <BookmarksProvider initialBookmarks={initialBookmarks}>
                <div className={`relative flex`}>
                    <NavBar isNavOn={isNavOn} toggleNavbar={toggleNavbar} />
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
                            <Header
                                toggleTheme={toggleTheme}
                                darkMode={darkMode}
                                toggleNavbar={toggleNavbar}
                                isNavOn={isNavOn}
                            />
                            {children}
                            <HomeFooter />
                        </div>
                    </main>
                </div>
            </BookmarksProvider>
        </GuestPromptProvider>
    );
}
