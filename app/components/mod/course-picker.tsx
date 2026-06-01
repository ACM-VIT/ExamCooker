"use client";

import React, { Activity, useEffect, useMemo, useReducer, useRef } from "react";
import { createCourse } from "@/app/actions/create-course";

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

type CoursePickerState = {
    createError: string | null;
    creating: boolean;
    highlight: number;
    newCode: string;
    newTitle: string;
    open: boolean;
    query: string;
    showCreate: boolean;
};

type CoursePickerAction =
    | { type: "close" }
    | { type: "open" }
    | { type: "query"; value: string }
    | { type: "highlight"; value: number }
    | { type: "highlight-next"; maxIndex: number }
    | { type: "highlight-previous" }
    | { type: "selected" }
    | { type: "cleared" }
    | { type: "start-create"; code: string }
    | { type: "new-code"; value: string }
    | { type: "new-title"; value: string }
    | { type: "cancel-create" }
    | { type: "create-start" }
    | { type: "create-error"; message: string }
    | { type: "create-success" }
    | { type: "create-complete" };

const initialCoursePickerState: CoursePickerState = {
    createError: null,
    creating: false,
    highlight: 0,
    newCode: "",
    newTitle: "",
    open: false,
    query: "",
    showCreate: false,
};

function coursePickerReducer(
    state: CoursePickerState,
    action: CoursePickerAction,
): CoursePickerState {
    switch (action.type) {
        case "close":
            return { ...state, open: false };
        case "open":
            return { ...state, open: true };
        case "query":
            return {
                ...state,
                highlight: 0,
                open: true,
                query: action.value,
            };
        case "highlight":
            return { ...state, highlight: action.value };
        case "highlight-next":
            return {
                ...state,
                highlight: Math.min(state.highlight + 1, Math.max(action.maxIndex, 0)),
            };
        case "highlight-previous":
            return { ...state, highlight: Math.max(state.highlight - 1, 0) };
        case "selected":
            return {
                ...state,
                highlight: 0,
                open: false,
                query: "",
            };
        case "cleared":
            return {
                ...state,
                highlight: 0,
                query: "",
            };
        case "start-create":
            return {
                ...state,
                createError: null,
                newCode: action.code,
                newTitle: "",
                open: false,
                showCreate: true,
            };
        case "new-code":
            return { ...state, newCode: action.value.toUpperCase() };
        case "new-title":
            return { ...state, newTitle: action.value };
        case "cancel-create":
            return { ...state, showCreate: false };
        case "create-start":
            return { ...state, createError: null, creating: true };
        case "create-error":
            return { ...state, createError: action.message };
        case "create-success":
            return {
                ...state,
                newCode: "",
                newTitle: "",
                query: "",
                showCreate: false,
            };
        case "create-complete":
            return { ...state, creating: false };
    }
}

export default function CoursePicker({
    courses,
    value,
    onChange,
    allowCreateCourse = false,
    onCourseCreated,
    placeholder,
}: Props) {
    const [
        {
            createError,
            creating,
            highlight,
            newCode,
            newTitle,
            open,
            query,
            showCreate,
        },
        dispatch,
    ] = useReducer(coursePickerReducer, initialCoursePickerState);
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
    const dropdownVisible = open && !currentCourse && (results.length > 0 || allowCreateCourse);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                dispatch({ type: "close" });
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const choose = (course: CourseOption) => {
        onChange(course.id);
        dispatch({ type: "selected" });
    };

    const clear = () => {
        onChange(null);
        dispatch({ type: "cleared" });
    };

    const startCreate = () => {
        dispatch({ type: "start-create", code: query.trim().toUpperCase() });
    };

    const submitCreate = async () => {
        dispatch({ type: "create-start" });
        try {
            const result = await createCourse({ code: newCode, title: newTitle });
            if ("error" in result) {
                dispatch({ type: "create-error", message: result.error });
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
            dispatch({ type: "create-success" });
        } finally {
            dispatch({ type: "create-complete" });
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
                    aria-label="Search courses"
                    value={query}
                    onChange={(e) => {
                        dispatch({ type: "query", value: e.target.value });
                    }}
                    onFocus={() => dispatch({ type: "open" })}
                    onKeyDown={(e) => {
                        if (!open) return;
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            dispatch({
                                type: "highlight-next",
                                maxIndex: results.length - 1,
                            });
                        } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            dispatch({ type: "highlight-previous" });
                        } else if (e.key === "Enter") {
                            e.preventDefault();
                            if (results[highlight]) choose(results[highlight]);
                        } else if (e.key === "Escape") {
                            dispatch({ type: "close" });
                        }
                    }}
                    placeholder={placeholder ?? "Search course by code, title, or alias"}
                    className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm text-black dark:text-[#D5D5D5] placeholder-black/40 dark:placeholder-[#D5D5D5]/30 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                />
            )}

            <Activity mode={dropdownVisible ? "visible" : "hidden"}>
                <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] shadow-lg">
                    {results.length > 0 ? (
                        results.map((c, idx) => (
                            <li
                                key={c.id}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    choose(c);
                                }}
                                onMouseEnter={() => dispatch({ type: "highlight", value: idx })}
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
                        ))
                    ) : allowCreateCourse ? (
                        <li className="px-3 py-2 text-xs text-black/60 dark:text-[#D5D5D5]/60">
                            No matching course.
                        </li>
                    ) : null}
                    {allowCreateCourse ? (
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
                    ) : null}
                </ul>
            </Activity>

            {allowCreateCourse && showCreate && !currentCourse && (
                <div className="mt-2 border border-black/30 bg-white p-3 dark:border-[#D5D5D5]/40 dark:bg-[#0C1222]">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
                        <input
                            type="text"
                            value={newCode}
                            aria-label="New course code"
                            onChange={(e) => dispatch({ type: "new-code", value: e.target.value })}
                            placeholder="Code"
                            className="w-full border border-black/30 bg-white px-3 py-2 font-mono text-sm text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7] dark:border-[#D5D5D5]/40 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:placeholder-[#D5D5D5]/30"
                        />
                        <input
                            type="text"
                            value={newTitle}
                            aria-label="New course title"
                            onChange={(e) => dispatch({ type: "new-title", value: e.target.value })}
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
                            onClick={() => dispatch({ type: "cancel-create" })}
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
