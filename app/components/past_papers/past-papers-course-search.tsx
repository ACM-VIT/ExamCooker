"use client";

import React, { addTransitionType, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Image from "@/app/components/common/app-image";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import { useRouter } from "next/navigation";
import { normalizeCourseCode } from "@/lib/course-tags";
import {
    captureCourseSearchSelection,
    captureCourseSearchSubmitted,
    type CourseSearchInteraction,
} from "@/lib/posthog/client";
import {
    canUseNativeCourseSearch,
    presentNativeCourseSearch,
} from "@/lib/native-course-search";

export type SearchableCourse = {
    id: string;
    code: string;
    title: string;
    paperCount: number;
    noteCount: number;
    aliases?: string[];
};

type Props = {
    courses: SearchableCourse[];
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

export default function PastPapersCourseSearch({
    courses,
    initialQuery = "",
}: Props) {
    const router = useRouter();
    const initialQueryRef = useRef(initialQuery);
    const [query, setQuery] = useState(initialQueryRef.current);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [nativeSearchAvailable, setNativeSearchAvailable] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
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
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        setNativeSearchAvailable(canUseNativeCourseSearch());
    }, []);

    const navigate = (
        course: SearchableCourse,
        options?: {
            interaction?: CourseSearchInteraction;
            resultIndex?: number;
        },
    ) => {
        captureCourseSearchSelection({
            context: "past_papers",
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
            router.push(`/past_papers/${encodeURIComponent(course.code)}`);
        });
        setIsOpen(false);
    };

    const submitFreeText = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        const codeQuery = normalizeCourseCode(trimmed);
        const exact = courses.find((c) => c.code === codeQuery);
        captureCourseSearchSubmitted({
            context: "past_papers",
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
            router.push(`/past_papers?search=${encodeURIComponent(trimmed)}`);
        });
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            if (!isOpen || filtered.length === 0) return;
            e.preventDefault();
            setHighlightedIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
        } else if (e.key === "ArrowUp") {
            if (!isOpen || filtered.length === 0) return;
            e.preventDefault();
            setHighlightedIndex((i) => (i > 0 ? i - 1 : filtered.length - 1));
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
                title: "Past Papers",
                placeholder: "Search course or code",
                initialQuery: query,
                courses,
            });

            if (result.action === "cancel") return;

            if (result.action === "select") {
                const course = courses.find((item) => item.code === result.courseCode);
                if (!course) return;
                captureCourseSearchSelection({
                    context: "past_papers",
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
                    router.push(`/past_papers/${encodeURIComponent(course.code)}`);
                });
                return;
            }

            const trimmed = result.query.trim();
            if (!trimmed) return;
            const exact = result.exactCourseCode
                ? courses.find((course) => course.code === result.exactCourseCode)
                : undefined;
            captureCourseSearchSubmitted({
                context: "past_papers",
                query: trimmed,
                resultCount: result.resultCount,
                exactMatchFound: Boolean(exact),
            });
            if (exact) {
                captureCourseSearchSelection({
                    context: "past_papers",
                    interaction: "submit_exact_match",
                    courseCode: exact.code,
                    resultCount: result.resultCount,
                    paperCount: exact.paperCount,
                    noteCount: exact.noteCount,
                    hasSyllabus: false,
                });
                startTransition(() => {
                    addTransitionType("nav-forward");
                    router.push(`/past_papers/${encodeURIComponent(exact.code)}`);
                });
                return;
            }
            startTransition(() => {
                router.push(`/past_papers?search=${encodeURIComponent(trimmed)}`);
            });
        } catch {
            setNativeSearchAvailable(false);
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
                        className={`h-full min-w-0 flex-1 bg-transparent px-4 py-0 text-left text-sm outline-none focus:outline-none focus-visible:outline-none sm:text-base ${
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
                        className="h-full min-w-0 flex-1 bg-transparent px-4 py-0 text-sm text-black placeholder:text-black/50 outline-none focus:outline-none focus-visible:outline-none sm:text-base dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/60"
                        placeholder="Search course or code..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsOpen(e.target.value.trim().length > 0);
                            setHighlightedIndex(-1);
                        }}
                        onFocus={() => query.trim() && setIsOpen(true)}
                        onKeyDown={handleKeyDown}
                    />
                )}
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

            {!nativeSearchAvailable && isOpen && filtered.length > 0 && (
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
                                {course.paperCount > 0 && (
                                    <span className="border border-black/40 px-1.5 py-0.5 text-black/70 dark:border-[#5FC4E7]/50 dark:text-[#5FC4E7]">
                                        {course.paperCount} papers
                                    </span>
                                )}
                                {course.noteCount > 0 && (
                                    <span className="hidden border border-black/40 px-1.5 py-0.5 text-black/70 dark:border-[#3BF4C7]/50 dark:text-[#3BF4C7] sm:inline-flex">
                                        {course.noteCount} notes
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {!nativeSearchAvailable && isOpen && query.trim() && filtered.length === 0 && (
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
