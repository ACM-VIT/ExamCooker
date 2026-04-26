"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createCourse } from "@/app/actions/createCourse";

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
    allowCreateCourse?: boolean;
    onCourseCreated?: (course: CourseOption) => void;
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

export default function CoursePicker({
    courses,
    value,
    onChange,
    allowCreateCourse = false,
    onCourseCreated,
    placeholder,
}: Props) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [showCreate, setShowCreate] = useState(false);
    const [newCode, setNewCode] = useState("");
    const [newTitle, setNewTitle] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
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

    const startCreate = () => {
        setCreateError(null);
        setNewCode(query.trim().toUpperCase());
        setNewTitle("");
        setShowCreate(true);
        setOpen(false);
    };

    const submitCreate = async () => {
        setCreateError(null);
        setCreating(true);
        try {
            const result = await createCourse({ code: newCode, title: newTitle });
            if (result.success === false) {
                setCreateError(result.error);
                return;
            }

            const course = {
                id: result.id,
                code: result.code,
                title: result.title,
                aliases: result.aliases,
            };
            onCourseCreated?.(course);
            onChange(course.id);
            setQuery("");
            setNewCode("");
            setNewTitle("");
            setShowCreate(false);
        } finally {
            setCreating(false);
        }
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
                    {allowCreateCourse && (
                        <li className="border-t border-black/10 dark:border-[#D5D5D5]/20 p-2">
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    startCreate();
                                }}
                                className="w-full border border-black/30 px-3 py-2 text-left text-xs font-semibold text-black hover:bg-black/5 dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                            >
                                Add missing course
                            </button>
                        </li>
                    )}
                </ul>
            )}

            {allowCreateCourse && open && !currentCourse && results.length === 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 border border-black/30 bg-white p-2 shadow-lg dark:border-[#D5D5D5]/40 dark:bg-[#0C1222]">
                    <p className="px-1 pb-2 text-xs text-black/60 dark:text-[#D5D5D5]/60">
                        No matching course.
                    </p>
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            startCreate();
                        }}
                        className="w-full border border-black/30 px-3 py-2 text-left text-xs font-semibold text-black hover:bg-black/5 dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                    >
                        Add missing course
                    </button>
                </div>
            )}

            {allowCreateCourse && showCreate && !currentCourse && (
                <div className="mt-2 border border-black/30 bg-white p-3 dark:border-[#D5D5D5]/40 dark:bg-[#0C1222]">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
                        <input
                            type="text"
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                            placeholder="Code"
                            className="w-full border border-black/30 bg-white px-3 py-2 font-mono text-sm text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7] dark:border-[#D5D5D5]/40 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:placeholder-[#D5D5D5]/30"
                        />
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Course title"
                            className="w-full border border-black/30 bg-white px-3 py-2 text-sm text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7] dark:border-[#D5D5D5]/40 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:placeholder-[#D5D5D5]/30"
                        />
                    </div>
                    {createError && (
                        <p className="mt-2 text-xs text-red-700 dark:text-red-400">{createError}</p>
                    )}
                    <div className="mt-2 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setShowCreate(false)}
                            className="border border-black/30 px-3 py-1.5 text-xs font-semibold text-black hover:bg-black/5 dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submitCreate}
                            disabled={creating || !newCode.trim() || !newTitle.trim()}
                            className="border-2 border-black bg-[#5FC4E7] px-3 py-1.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {creating ? "Adding..." : "Add course"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
