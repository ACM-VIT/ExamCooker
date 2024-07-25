"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

function ThemeToggleSwitch() {
    const [mounted, setMounted] = useState(false);
    const [darkMode, setDarkMode] = useState(true)

    useEffect(() => {
        const theme = localStorage.getItem('theme');
        const isDarkMode = theme === 'dark' || (theme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setDarkMode(isDarkMode);
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            if (darkMode) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            }
        }
    }, [darkMode, mounted]);

    const toggleTheme = () => setDarkMode(!darkMode);

    if (!mounted) {
        return null;
    }

    return (
        <div onClick={toggleTheme} className="relative overflow-hidden flex items-center justify-center w-10 h-6 dark:bg-[#121B31] border-[1px] border-[#2699E9] dark:border-[#D5D5D5] rounded-full hover:border-1 hover:border-[#3BF4C7] dark:hover:border-[#3BF4C7] transition-all ease-linear  duration-150 cursor-pointer">
            <div className="flex justify-center items-center bg-[#D0E9ED] dark:bg-[#0C1120] shadow-md w-4 h-4 rounded-full -translate-x-2 dark:translate-x-2 transition-transform ease-in-out">
                <Image src={"/assets/LucideSun.svg"} alt="Sun" width={25} height={25} className={`${darkMode ? "hidden" : ""}`} />
                <Image src={"/assets/LucideMoon.svg"} alt="Moon" width={25} height={25} className={`invert-[.835] ${!darkMode ? "hidden" : ""}`} />
            </div>
        </div>
    )}

export default ThemeToggleSwitch;