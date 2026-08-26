"use client";

import React, { Activity, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Image from "@/app/components/common/app-image";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import { useRouter } from "next/navigation";
import { addTransitionType } from "@/app/components/common/react-transition";
import { getAliasCourseCodes } from "@/lib/course-aliases";
import { createCourseFuse } from "@/lib/course-search-fuse";
import { normalizeCourseCode } from "@/lib/course-tags";
import {
    captureCourseSearchNoResults,
    captureCourseSearchSelection,
    captureCourseSearchSubmitted,
    type CourseSearchInteraction,
} from "@/lib/posthog/client";
import {
    presentNativeCourseSearch,
    useNativeCourseSearchAvailable,
} from "@/lib/native-course-search";

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

const MAX_RESULTS = 8;

export default function NotesCourseSearch({
    courses,
    initialQuery = "",
}: Props) {
    const { push } = useRouter();
    const [query, setQuery] = useState(() => initialQuery);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const hasSearchInteraction = useRef(false);
    const nativeCourseSearchAvailable = useNativeCourseSearchAvailable();
    const [nativeSearchUnavailable, setNativeSearchUnavailable] = useState(false);
    const nativeSearchAvailable =
        nativeCourseSearchAvailable && !nativeSearchUnavailable;
    const deferredQuery = useDeferredValue(query);

    // Fuzzy index shared with the homepage / past-papers dropdowns (same weights
    // and threshold via `createCourseFuse`), so typos and word-order variations
    // ("applied chemistry") match here instead of dead-ending on the old
    // exact-substring logic.
    const courseFuse = useMemo(() => createCourseFuse(courses), [courses]);

    const filtered = useMemo(() => {
        const trimmed = deferredQuery.trim();
        if (!trimmed) return [];

        const aliasCodes = getAliasCourseCodes(trimmed);
        const aliasSet = new Set(aliasCodes.map((code) => code.toUpperCase()));
        const normalizedCodeQuery = normalizeCourseCode(trimmed);

        const matches: SearchableNoteCourseItem[] = [];
        const seen = new Set<string>();
        const pushCourse = (course: SearchableNoteCourseItem) => {
            if (seen.has(course.code)) return;
            seen.add(course.code);
            matches.push(course);
        };

        // 1. Exact code + acronym/alias matches — highest confidence, always first.
        for (const course of courses) {
            const codeUpper = course.code.toUpperCase();
            if (aliasSet.has(codeUpper) || codeUpper === normalizedCodeQuery) {
                pushCourse(course);
            }
        }

        // 2. Course-code prefixes (e.g. typing "BCSE20" before finishing the code).
        if (normalizedCodeQuery.length >= 2) {
            for (const course of courses) {
                if (matches.length >= MAX_RESULTS) break;
                if (course.code.toUpperCase().startsWith(normalizedCodeQuery)) {
                    pushCourse(course);
                }
            }
        }

        // 3. Fuzzy relevance ranking for everything else (typos, word order, titles).
        for (const { item } of courseFuse.search(trimmed, { limit: MAX_RESULTS })) {
            if (matches.length >= MAX_RESULTS) break;
            pushCourse(item);
        }

        return matches.slice(0, MAX_RESULTS);
    }, [deferredQuery, courses, courseFuse]);
    const dropdownVisible =
        !nativeSearchAvailable && isOpen && (filtered.length > 0 || query.trim().length > 0);

    // Report queries that settle on zero results so failed notes searches stop
    // being invisible in analytics (previously `course_search_no_results` only
    // ever fired from the homepage). Debounced and de-duplicated so a single
    // failed search fires one event rather than one per keystroke.
    const lastNoResultQuery = useRef<string | null>(null);
    useEffect(() => {
        if (!hasSearchInteraction.current) return;

        const trimmed = deferredQuery.trim();
        if (trimmed.length < 2 || filtered.length > 0) return;
        if (lastNoResultQuery.current === trimmed) return;

        const timeoutId = window.setTimeout(() => {
            lastNoResultQuery.current = trimmed;
            captureCourseSearchNoResults({ context: "notes", query: trimmed });
        }, 600);

        return () => window.clearTimeout(timeoutId);
    }, [deferredQuery, filtered]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const navigate = (
        course: SearchableNoteCourseItem,
        options?: {
            interaction?: CourseSearchInteraction;
            resultIndex?: number;
        },
    ) => {
        captureCourseSearchSelection({
            context: "notes",
            interaction: options?.interaction ?? "click",
            courseCode: course.code,
            resultCount: filtered.length,
            resultIndex: options?.resultIndex,
            paperCount: course.paperCount,
            noteCount: course.noteCount,
            hasSyllabus: false,
        });

        startTransition(() => {
            addTransitionType("nav-forward");
            push(`/notes/course/${encodeURIComponent(course.code)}`);
        });
        setIsOpen(false);
    };

    const submitFreeText = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        const codeQuery = normalizeCourseCode(trimmed);
        const exact = courses.find((c) => c.code === codeQuery);
        captureCourseSearchSubmitted({
            context: "notes",
            query: trimmed,
            resultCount: filtered.length,
            exactMatchFound: Boolean(exact),
        });
        if (exact) {
            navigate(exact, {
                interaction: "submit_exact_match",
            });
            return;
        }
        startTransition(() => {
            addTransitionType("filter-results");
            push(`/notes?search=${encodeURIComponent(trimmed)}`);
        });
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            if (!isOpen || filtered.length === 0) return;
            e.preventDefault();
            setHighlightedIndex((currentIndex) =>
                currentIndex < filtered.length - 1 ? currentIndex + 1 : 0,
            );
        } else if (e.key === "ArrowUp") {
            if (!isOpen || filtered.length === 0) return;
            e.preventDefault();
            setHighlightedIndex((currentIndex) =>
                currentIndex > 0 ? currentIndex - 1 : filtered.length - 1,
            );
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (isOpen && highlightedIndex >= 0 && filtered[highlightedIndex]) {
                navigate(filtered[highlightedIndex], {
                    interaction: "keyboard",
                    resultIndex: highlightedIndex,
                });
            } else {
                submitFreeText();
            }
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    const clear = () => {
        setQuery("");
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.focus();
    };

    const handleNativeSearch = async () => {
        try {
            const result = await presentNativeCourseSearch({
                title: "Notes",
                placeholder: "Search course or code",
                initialQuery: query,
                courses,
            });

            if (result.action === "cancel") return;

            if (result.action === "select") {
                const course = courses.find((item) => item.code === result.courseCode);
                if (!course) return;
                captureCourseSearchSelection({
                    context: "notes",
                    interaction: "mobile_tap",
                    courseCode: course.code,
                    resultCount: result.resultCount,
                    resultIndex: result.resultIndex,
                    paperCount: course.paperCount,
                    noteCount: course.noteCount,
                    hasSyllabus: false,
                });
                startTransition(() => {
                    addTransitionType("nav-forward");
                    push(`/notes/course/${encodeURIComponent(course.code)}`);
                });
                return;
            }

            const trimmed = result.query.trim();
            if (!trimmed) return;
            const exact = result.exactCourseCode
                ? courses.find((course) => course.code === result.exactCourseCode)
                : undefined;
            captureCourseSearchSubmitted({
                context: "notes",
                query: trimmed,
                resultCount: result.resultCount,
                exactMatchFound: Boolean(exact),
            });
            if (result.resultCount === 0) {
                captureCourseSearchNoResults({ context: "notes", query: trimmed });
            }
            if (exact) {
                captureCourseSearchSelection({
                    context: "notes",
                    interaction: "submit_exact_match",
                    courseCode: exact.code,
                    resultCount: result.resultCount,
                    paperCount: exact.paperCount,
                    noteCount: exact.noteCount,
                    hasSyllabus: false,
                });
                startTransition(() => {
                    addTransitionType("nav-forward");
                    push(`/notes/course/${encodeURIComponent(exact.code)}`);
                });
                return;
            }
            startTransition(() => {
                addTransitionType("filter-results");
                push(`/notes?search=${encodeURIComponent(trimmed)}`);
            });
        } catch {
            setNativeSearchUnavailable(true);
            inputRef.current?.focus();
        }
    };

    return (
        <div className="relative w-full text-left">
            <div className="relative flex h-12 w-full items-center border border-black/25 bg-white px-2 dark:border-[#D5D5D5]/30 dark:bg-[#3D414E]">
                <Image src={SearchIcon} alt="search" className="dark:invert-[.835]" />
                {nativeSearchAvailable ? (
                    <button
                        type="button"
                        onClick={handleNativeSearch}
                        className={`h-full min-w-0 flex-1 bg-transparent px-4 py-0 text-left text-sm focus:outline-none sm:text-base ${
                            query
                                ? "text-black dark:text-[#D5D5D5]"
                                : "text-black/50 dark:text-[#D5D5D5]/60"
                        }`}
                    >
                        {query || "Search course or code..."}
                    </button>
                ) : (
                    <input
                        ref={inputRef}
                        type="text"
                        aria-label="Search course or code"
                        className="h-full min-w-0 flex-1 bg-transparent px-4 py-0 text-sm text-black placeholder:text-black/50 focus:outline-none sm:text-base dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/60"
                        placeholder="Search course or code..."
                        value={query}
                        onChange={(e) => {
                            hasSearchInteraction.current = true;
                            setQuery(e.target.value);
                            setIsOpen(e.target.value.trim().length > 0);
                            setHighlightedIndex(-1);
                        }}
                        onFocus={() => {
                            if (!query.trim()) return;
                            setIsOpen(true);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                )}
                {query && (
                    <button
                        onClick={clear}
                        type="button"
                        aria-label="Clear search"
                        className="inline-flex size-7 items-center justify-center text-black/60 transition-colors hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                    >
                        <svg
                            viewBox="0 0 14 14"
                            aria-hidden="true"
                            className="size-3.5"
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

            <Activity mode={dropdownVisible ? "visible" : "hidden"}>
                <div
                    ref={dropdownRef}
                    className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto border border-black/15 bg-white shadow-lg dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]"
                >
                    {filtered.length > 0 ? (
                        filtered.map((course, index) => (
                            <button
                                key={course.id}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    navigate(course, {
                                        interaction: "click",
                                        resultIndex: index,
                                    });
                                }}
                                onMouseEnter={() => setHighlightedIndex(index)}
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
                        ))
                    ) : query.trim() ? (
                        <div className="px-4 py-4 text-center text-sm text-black/60 dark:text-[#D5D5D5]/60">
                            No courses found for &quot;{query}&quot;.
                        </div>
                    ) : null}
                </div>
            </Activity>
        </div>
    );
}
