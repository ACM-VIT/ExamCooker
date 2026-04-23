"use client";

import React, { useEffect, useState } from "react";

function ThemeToggleSwitch() {
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        setDarkMode(document.documentElement.classList.contains("dark"));
    }, []);

    const applyTheme = (next: boolean) => {
        const root = document.documentElement;
        if (next) {
            root.classList.add("dark");
            localStorage.setItem("theme", "dark");
        } else {
            root.classList.remove("dark");
            localStorage.setItem("theme", "light");
        }
        setDarkMode(next);
    };

    const toggleTheme = () => {
        applyTheme(!darkMode);
    };

    const isDark = darkMode === true;

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDark}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-white/40 text-black/70 transition-colors duration-200 hover:border-black/40 hover:text-black hover:bg-white dark:border-[#D5D5D5]/20 dark:bg-white/5 dark:text-[#D5D5D5]/70 dark:hover:border-[#3BF4C7]/60 dark:hover:text-[#3BF4C7] dark:hover:bg-white/10"
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`absolute h-4 w-4 transition-transform duration-300 ease-out ${
                    isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
                }`}
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m4.93 19.07 1.41-1.41" />
                <path d="m17.66 6.34 1.41-1.41" />
            </svg>
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`absolute h-4 w-4 transition-transform duration-300 ease-out ${
                    isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
                }`}
                aria-hidden="true"
            >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
        </button>
    );
}

export default ThemeToggleSwitch;
