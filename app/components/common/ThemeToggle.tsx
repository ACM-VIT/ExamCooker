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
        <div onClick={() => setDarkMode(!darkMode)} className="w-16 h-8 bg-red-500 dark:bg-white cursor-pointer">
            CLICK ME
        </div>
    );
}

export default ThemeToggleSwitch;
