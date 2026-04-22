"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type CourseOption = {
    id: string;
    code: string;
    title: string;
    aliases: string[];
};

type Props = {
    courses: CourseOption[];
    value: string | null;
    onChange: (courseId: string | null) => void;
    placeholder?: string;
};

function scoreCourse(course: CourseOption, q: string): number {
    const code = course.code.toLowerCase();
    const title = course.title.toLowerCase();
    if (!q) return 0;
    if (code === q) return 1000;
    if (code.startsWith(q)) return 500;
    if (title.toLowerCase().startsWith(q)) return 300;
    if (code.includes(q)) return 200;
    if (title.includes(q)) return 100;
    for (const alias of course.aliases) {
        if (alias.toLowerCase().includes(q)) return 50;
    }
    return 0;
}

export default function CoursePicker({ courses, value, onChange, placeholder }: Props) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentCourse = useMemo(
        () => (value ? courses.find((c) => c.id === value) ?? null : null),
        [courses, value],
    );

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) {
            return courses.slice(0, 10);
        }
        return courses
            .map((c) => ({ course: c, score: scoreCourse(c, q) }))
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((r) => r.course);
    }, [query, courses]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => setHighlight(0), [query]);

    const choose = (course: CourseOption) => {
        onChange(course.id);
        setQuery("");
        setOpen(false);
    };

    const clear = () => {
        onChange(null);
        setQuery("");
    };

    return (
        <div ref={containerRef} className="relative w-full">
            {currentCourse ? (
                <div className="flex items-center gap-2 border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm">
                    <span className="font-mono text-xs text-black/60 dark:text-[#D5D5D5]/60">
                        {currentCourse.code}
                    </span>
                    <span className="flex-1 truncate text-black dark:text-[#D5D5D5]">
                        {currentCourse.title}
                    </span>
                    <button
                        type="button"
                        onClick={clear}
                        className="text-xs text-black/60 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:text-[#3BF4C7]"
                    >
                        change
                    </button>
                </div>
            ) : (
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => {
                        if (!open) return;
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setHighlight((h) => Math.min(h + 1, results.length - 1));
                        } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setHighlight((h) => Math.max(h - 1, 0));
                        } else if (e.key === "Enter") {
                            e.preventDefault();
                            if (results[highlight]) choose(results[highlight]);
                        } else if (e.key === "Escape") {
                            setOpen(false);
                        }
                    }}
                    placeholder={placeholder ?? "Search course by code, title, or alias"}
                    className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm text-black dark:text-[#D5D5D5] placeholder-black/40 dark:placeholder-[#D5D5D5]/30 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                />
            )}

            {open && !currentCourse && results.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] shadow-lg">
                    {results.map((c, idx) => (
                        <li
                            key={c.id}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                choose(c);
                            }}
                            onMouseEnter={() => setHighlight(idx)}
                            className={`cursor-pointer px-3 py-2 text-sm ${
                                idx === highlight
                                    ? "bg-[#5FC4E7]/40 dark:bg-[#3BF4C7]/10"
                                    : ""
                            }`}
                        >
                            <span className="font-mono text-xs text-black/60 dark:text-[#D5D5D5]/60">
                                {c.code}
                            </span>{" "}
                            <span className="text-black dark:text-[#D5D5D5]">{c.title}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
