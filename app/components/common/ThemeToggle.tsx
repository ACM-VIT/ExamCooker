"use client";

import { useEffect, useState } from "react";

function ThemeToggleSwitch() {

    const [darkMode, setDarkMode] = useState(true)

    useEffect(() => {
        const theme = localStorage.getItem('theme');
        if (theme === 'dark') {
            setDarkMode(true);
        }
    }, [])

    useEffect(() => {
        if(darkMode){
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    },[darkMode])

    return (
        <div onClick={() => setDarkMode(!darkMode)} className="flex items-center justify-center w-16 h-8 rounded-full bg-[#262626] border-4 border-[#0F1E21] transition-all ease-in dark:border-[#E9E9E9] dark:bg-white cursor-pointer">
            <div className="bg-blue-400 dark:bg-white w-8 h-8 rounded-full -translate-x-4 dark:translate-x-4 transition-transform ease-in"></div>
            <div></div>
        </div>
    );
}

export default ThemeToggleSwitch;
