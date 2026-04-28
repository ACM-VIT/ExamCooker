"use client";

import React, { addTransitionType, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Image from "@/app/components/common/AppImage";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import { useRouter } from "next/navigation";
import { normalizeCourseCode } from "@/lib/courseTags";

export type SearchableNoteCourseItem = {
    id: string;
    code: string;
    title: string;
    noteCount: number;
    paperCount: number;
    aliases?: string[];
};

type Props = {
    courses: SearchableNoteCourseItem[];
    initialQuery?: string;
};

function normalizeSearchInput(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const MAX_RESULTS = 8;

export default function NotesCourseSearch({
    courses,
    initialQuery = "",
}: Props) {
    const router = useRouter();
    const [uiState, setUiState] = useState({
        query: "",
        isOpen: false,
        highlightedIndex: -1,
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { query, isOpen, highlightedIndex } = uiState;
    const deferredQuery = useDeferredValue(query);

    const searchableCourses = useMemo(
        () =>
            courses.map((course) => ({
                course,
                code: course.code,
                normalizedHaystack: normalizeSearchInput(
                    `${course.code} ${course.title} ${(course.aliases ?? []).join(" ")}`,
                ),
            })),
        [courses],
    );

    useEffect(() => {
        setUiState((currentState) => {
            if (
                currentState.query === initialQuery &&
                !currentState.isOpen &&
                currentState.highlightedIndex === -1
            ) {
                return currentState;
            }

            return {
                query: initialQuery,
                isOpen: false,
                highlightedIndex: -1,
            };
        });
    }, [initialQuery]);

    const filtered = useMemo(() => {
        const trimmed = deferredQuery.trim();
        if (!trimmed) return [];

        const codeQuery = normalizeCourseCode(trimmed);
        const normalized = normalizeSearchInput(trimmed);
        const terms = normalized.split(" ").filter(Boolean);

        return searchableCourses
            .filter(({ course, code, normalizedHaystack }) => {
                if (course.code === codeQuery) return true;
                if (code.startsWith(codeQuery) && codeQuery.length >= 2) return true;
                return terms.every((term) => normalizedHaystack.includes(term));
            })
            .map(({ course }) => course)
            .slice(0, MAX_RESULTS);
    }, [deferredQuery, searchableCourses]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setUiState((currentState) => ({ ...currentState, isOpen: false }));
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const navigate = (course: SearchableNoteCourseItem) => {
        startTransition(() => {
            addTransitionType("nav-forward");
            router.push(`/notes/course/${encodeURIComponent(course.code)}`);
        });
        setUiState((currentState) => ({ ...currentState, isOpen: false }));
    };

    const submitFreeText = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        const codeQuery = normalizeCourseCode(trimmed);
        const exact = courses.find((c) => c.code === codeQuery);
        if (exact) {
            navigate(exact);
            return;
        }
        startTransition(() => {
            addTransitionType("filter-results");
            router.push(`/notes?search=${encodeURIComponent(trimmed)}`);
        });
        setUiState((currentState) => ({ ...currentState, isOpen: false }));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            if (!isOpen || filtered.length === 0) return;
            e.preventDefault();
            setUiState((currentState) => ({
                ...currentState,
                highlightedIndex:
                    currentState.highlightedIndex < filtered.length - 1
                        ? currentState.highlightedIndex + 1
                        : 0,
            }));
        } else if (e.key === "ArrowUp") {
            if (!isOpen || filtered.length === 0) return;
            e.preventDefault();
            setUiState((currentState) => ({
                ...currentState,
                highlightedIndex:
                    currentState.highlightedIndex > 0
                        ? currentState.highlightedIndex - 1
                        : filtered.length - 1,
            }));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (isOpen && highlightedIndex >= 0 && filtered[highlightedIndex]) {
                navigate(filtered[highlightedIndex]);
            } else {
                submitFreeText();
            }
        } else if (e.key === "Escape") {
            setUiState((currentState) => ({ ...currentState, isOpen: false }));
        }
    };

    const clear = () => {
        setUiState({
            query: "",
            isOpen: false,
            highlightedIndex: -1,
        });
        inputRef.current?.focus();
    };

    return (
        <div className="relative w-full text-left">
            <div className="relative flex h-12 w-full items-center border border-black/25 bg-white px-2 dark:border-[#D5D5D5]/30 dark:bg-[#3D414E]">
                <Image src={SearchIcon} alt="search" className="dark:invert-[.835]" />
                <input
                    ref={inputRef}
                    type="text"
                    className="h-full min-w-0 flex-1 bg-transparent px-4 py-0 text-sm text-black placeholder:text-black/50 focus:outline-none sm:text-base dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/60"
                    placeholder="Search course or code..."
                    value={query}
                    onChange={(e) => {
                        setUiState({
                            query: e.target.value,
                            isOpen: e.target.value.trim().length > 0,
                            highlightedIndex: -1,
                        });
                    }}
                    onFocus={() => {
                        if (!query.trim()) return;
                        setUiState((currentState) => ({ ...currentState, isOpen: true }));
                    }}
                    onKeyDown={handleKeyDown}
                />
                {query && (
                    <button
                        onClick={clear}
                        type="button"
                        aria-label="Clear search"
                        className="inline-flex h-7 w-7 items-center justify-center text-black/60 transition-colors hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                    >
                        <svg
                            viewBox="0 0 14 14"
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        >
                            <path d="M1 1L13 13M13 1L1 13" />
                        </svg>
                    </button>
                )}
            </div>

            {isOpen && filtered.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto border border-black/15 bg-white shadow-lg dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]"
                >
                    {filtered.map((course, index) => (
                        <button
                            key={course.id}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                navigate(course);
                            }}
                            onMouseEnter={() =>
                                setUiState((currentState) => ({
                                    ...currentState,
                                    highlightedIndex: index,
                                }))
                            }
                            className={`flex w-full items-center justify-between gap-3 border-b border-black/10 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#5FC4E7]/25 dark:border-[#D5D5D5]/15 dark:hover:bg-[#3BF4C7]/10 ${
                                highlightedIndex === index
                                    ? "bg-[#5FC4E7]/25 dark:bg-[#3BF4C7]/10"
                                    : ""
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold text-black dark:text-[#D5D5D5]">
                                    {course.title}
                                </div>
                                <div className="mt-0.5 text-xs uppercase tracking-wide text-black/60 dark:text-[#D5D5D5]/60">
                                    {course.code}
                                </div>
                            </div>
                            <div className="flex shrink-0 gap-1.5 text-[11px] font-semibold">
                                {course.noteCount > 0 && (
                                    <span className="border border-black/40 px-1.5 py-0.5 text-black/70 dark:border-[#3BF4C7]/50 dark:text-[#3BF4C7]">
                                        {course.noteCount} notes
                                    </span>
                                )}
                                {course.paperCount > 0 && (
                                    <span className="hidden border border-black/40 px-1.5 py-0.5 text-black/70 dark:border-[#5FC4E7]/50 dark:text-[#5FC4E7] sm:inline-flex">
                                        {course.paperCount} papers
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {isOpen && query.trim() && filtered.length === 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 mt-2 w-full border border-black/15 bg-white px-4 py-4 text-center text-sm text-black/60 shadow-lg dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/60"
                >
                    No courses found for &quot;{query}&quot;.
                </div>
            )}
        </div>
    );
}
