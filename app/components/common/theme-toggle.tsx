"use client";

import React, { useEffect, useRef, useState } from "react";

function ThemeToggleSwitch() {
    const [darkMode, setDarkMode] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

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

    const toggleTheme = async () => {
        const next = !darkMode;
        const button = buttonRef.current;
        const supportsViewTransitions = "startViewTransition" in document;
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (!supportsViewTransitions || prefersReducedMotion || !button) {
            applyTheme(next);
            return;
        }

        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y),
        );

        document.documentElement.classList.add("theme-transition");

        const transition = (document as Document & {
            startViewTransition: (callback: () => void) => {
                ready: Promise<void>;
                finished: Promise<void>;
            };
        }).startViewTransition(() => {
            applyTheme(next);
        });

        try {
            await transition.ready;
            document.documentElement.animate(
                {
                    clipPath: [
                        `circle(0px at ${x}px ${y}px)`,
                        `circle(${endRadius}px at ${x}px ${y}px)`,
                    ],
                },
                {
                    duration: 680,
                    easing: "cubic-bezier(0.76, 0, 0.24, 1)",
                    pseudoElement: "::view-transition-new(root)",
                },
            );
            await transition.finished;
        } catch {
            applyTheme(next);
        } finally {
            document.documentElement.classList.remove("theme-transition");
        }
    };

    const isDark = darkMode === true;

    return (
        <button
            ref={buttonRef}
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDark}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent bg-transparent text-black/70 shadow-none transition-colors duration-200 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7] dark:focus-visible:ring-[#3BF4C7]/50"
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
