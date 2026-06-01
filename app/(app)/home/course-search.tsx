'use client';

import React, { Activity, addTransitionType, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Image from "@/app/components/common/app-image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import VoiceAgentButton from "@/app/components/voice/voice-agent-button";
import { getAliasCourseCodes } from "@/lib/course-aliases";
import { normalizeCourseCode } from "@/lib/course-tags";
import {
    captureCourseSearchSelection,
    captureCourseSearchSubmitted,
    type CourseSearchInteraction,
    type VoiceAgentEntryPoint,
} from "@/lib/posthog/client";
import { POSTHOG_FEATURE_FLAGS } from "@/lib/posthog/shared";
import { usePostHogFeatureFlagEnabled } from "@/lib/posthog/use-feature-flag-enabled";
import { getCoursePastPapersPath } from "@/lib/seo";
import {
    presentNativeCourseSearch,
    useNativeCourseSearchAvailable,
} from "@/lib/native-course-search";

export type CourseResult = {
    code: string;
    title: string;
    noteCount: number;
    paperCount: number;
    syllabusId: string | null;
};

interface CourseSearchProps {
    courses: CourseResult[];
}

function normalizeSearchInput(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function includesAllTerms(value: string, terms: string[]) {
    for (const term of terms) {
        if (!value.includes(term)) return false;
    }

    return true;
}

function runAfterCurrentTask(callback: () => void) {
    if (typeof window === "undefined") {
        callback();
        return;
    }

    window.setTimeout(callback, 0);
}

export default function CourseSearch({ courses }: CourseSearchProps) {
    const { prefetch, push } = useRouter();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const nativeCourseSearchAvailable = useNativeCourseSearchAvailable();
    const [nativeSearchUnavailable, setNativeSearchUnavailable] = useState(false);
    const nativeSearchAvailable =
        nativeCourseSearchAvailable && !nativeSearchUnavailable;
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const deferredQuery = useDeferredValue(query);
    const voiceAgentEnabled =
        usePostHogFeatureFlagEnabled(POSTHOG_FEATURE_FLAGS.voiceAgent) ?? false;

    const navigateForward = (href: string, beforeNavigate?: () => void) => {
        startTransition(() => {
            beforeNavigate?.();
            addTransitionType("nav-forward");
            push(href);
        });
    };

    const navigateToSearch = (href: string) => {
        startTransition(() => {
            addTransitionType("filter-results");
            push(href);
        });
    };

    const searchableCourses = useMemo(
        () =>
            courses.map((course) => ({
                course,
                codeUpper: course.code.toUpperCase(),
                normalizedSearchable: normalizeSearchInput(
                    `${course.code} ${course.title}`,
                ),
            })),
        [courses],
    );

    const filteredCourses = useMemo(() => {
        const trimmed = deferredQuery.trim();
        if (!trimmed) return [];
        const aliasCodes = getAliasCourseCodes(trimmed);
        const aliasSet = new Set(aliasCodes.map((code) => code.toUpperCase()));
        const normalizedCodeQuery = normalizeCourseCode(trimmed);
        const normalizedQuery = normalizeSearchInput(trimmed);
        const queryTerms = normalizedQuery.split(" ").filter(Boolean);

        const matches: CourseResult[] = [];
        for (const { course, codeUpper, normalizedSearchable } of searchableCourses) {
            if (
                aliasSet.has(codeUpper) ||
                codeUpper === normalizedCodeQuery ||
                includesAllTerms(normalizedSearchable, queryTerms)
            ) {
                matches.push(course);
                if (matches.length === 8) break;
            }
        }

        return matches;
    }, [deferredQuery, searchableCourses]);
    const dropdownVisible =
        !nativeSearchAvailable && isOpen && (filteredCourses.length > 0 || query.trim().length > 0);

    useEffect(() => {
        if (!dropdownVisible || filteredCourses.length === 0) return;

        const timeoutId = window.setTimeout(() => {
            for (const course of filteredCourses.slice(0, 4)) {
                prefetch(getCoursePastPapersPath(course.code));
            }
        }, 50);

        return () => window.clearTimeout(timeoutId);
    }, [dropdownVisible, filteredCourses, prefetch]);

    const alignSearchInputForNativeAndroid = () => {
        if (
            typeof window === "undefined" ||
            !document.documentElement.hasAttribute("data-native-android")
        ) {
            return;
        }

        window.setTimeout(() => {
            inputRef.current?.scrollIntoView({
                block: "center",
                behavior: "smooth",
            });
        }, 180);
    };

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

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        setIsOpen(value.trim().length > 0);
        setHighlightedIndex(-1);
    };

    const recordCourseSelection = (
        course: CourseResult,
        options?: {
            interaction?: CourseSearchInteraction;
            resultIndex?: number;
        },
    ) => {
        const isMobile =
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 639px)").matches;
        const interaction =
            isMobile && options?.interaction === "click"
                ? "mobile_tap"
                : options?.interaction ?? "click";

        const selection = {
            context: "home",
            interaction,
            courseCode: course.code,
            resultCount: filteredCourses.length,
            resultIndex: options?.resultIndex,
            paperCount: course.paperCount,
            noteCount: course.noteCount,
            hasSyllabus: Boolean(course.syllabusId),
        } as const;

        runAfterCurrentTask(() => captureCourseSearchSelection(selection));
    };

    const closeSearchResults = () => {
        setIsOpen(false);
        setHighlightedIndex(-1);
    };

    const closeSearchResultsSoon = () => {
        runAfterCurrentTask(closeSearchResults);
    };

    const handleSelectCourse = (
        course: CourseResult,
        options?: {
            interaction?: CourseSearchInteraction;
            resultIndex?: number;
        },
    ) => {
        recordCourseSelection(course, options);

        navigateForward(getCoursePastPapersPath(course.code), closeSearchResults);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || filteredCourses.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev =>
                prev < filteredCourses.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev =>
                prev > 0 ? prev - 1 : filteredCourses.length - 1
            );
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            handleSelectCourse(filteredCourses[highlightedIndex], {
                interaction: "keyboard",
                resultIndex: highlightedIndex,
            });
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const clearSelection = () => {
        setQuery('');
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleVoiceClick = () => {
        if (typeof window === "undefined" || !voiceAgentEnabled) return;
        window.dispatchEvent(
            new CustomEvent<{ source: VoiceAgentEntryPoint }>(
                "examcooker:voice-agent-start",
                {
                    detail: {
                        source: "home_search",
                    },
                },
            ),
        );
    };

    const handleNativeSearch = async () => {
        try {
            const result = await presentNativeCourseSearch({
                title: "Search Courses",
                placeholder: "Search course or code",
                initialQuery: query,
                courses,
            });

            if (result.action === "cancel") return;

            if (result.action === "select") {
                const course = courses.find((item) => item.code === result.courseCode);
                if (!course) return;
                captureCourseSearchSelection({
                    context: "home",
                    interaction: "mobile_tap",
                    courseCode: course.code,
                    resultCount: result.resultCount,
                    resultIndex: result.resultIndex,
                    paperCount: course.paperCount,
                    noteCount: course.noteCount,
                    hasSyllabus: Boolean(course.syllabusId),
                });
                navigateForward(getCoursePastPapersPath(course.code));
                return;
            }

            const trimmed = result.query.trim();
            if (!trimmed) return;
            const exact = result.exactCourseCode
                ? courses.find((course) => course.code === result.exactCourseCode)
                : undefined;
            captureCourseSearchSubmitted({
                context: "home",
                query: trimmed,
                resultCount: result.resultCount,
                exactMatchFound: Boolean(exact),
            });
            if (exact) {
                captureCourseSearchSelection({
                    context: "home",
                    interaction: "submit_exact_match",
                    courseCode: exact.code,
                    resultCount: result.resultCount,
                    paperCount: exact.paperCount,
                    noteCount: exact.noteCount,
                    hasSyllabus: Boolean(exact.syllabusId),
                });
                navigateForward(getCoursePastPapersPath(exact.code));
                return;
            }
            navigateToSearch(`/past_papers?search=${encodeURIComponent(trimmed)}`);
        } catch {
            setNativeSearchUnavailable(true);
            inputRef.current?.focus();
        }
    };

    return (
        <div className="mx-auto w-full min-w-0 text-left">
            <div className="relative">
                <div className="ec-focus-ring relative flex h-12 sm:h-14 lg:h-16 w-full min-w-0 items-center overflow-hidden bg-white pl-4 pr-2 dark:bg-[#3D414E] border border-black/25 dark:border-[#D5D5D5]/30">
                    <Image src={SearchIcon} alt="search" className="dark:invert-[.835] size-5 sm:size-6 shrink-0" />
                    {nativeSearchAvailable ? (
                        <button
                            type="button"
                            onClick={handleNativeSearch}
                            className={`h-full min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent px-3 text-left text-sm focus:outline-none sm:px-4 sm:text-base lg:text-lg ${
                                query
                                    ? "text-black dark:text-[#D5D5D5]"
                                    : "text-black/50 dark:text-[#D5D5D5]/60"
                            }`}
                        >
                            {query || "Search for a course..."}
                        </button>
                    ) : (
                        <input
                            ref={inputRef}
                            type="text"
                            inputMode="search"
                            enterKeyHint="search"
                            autoCapitalize="off"
                            autoCorrect="off"
                            autoComplete="off"
                            spellCheck={false}
                            aria-label="Search for a course"
                            className="h-full min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent px-3 text-sm text-black focus:outline-none placeholder:text-black/50 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/60 sm:px-4 sm:text-base lg:text-lg"
                            placeholder="Search for a course..."
                            value={query}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onFocus={() => {
                                if (query.trim()) {
                                    setIsOpen(true);
                                }
                                alignSearchInputForNativeAndroid();
                            }}
                        />
                    )}
                    <button
                        onClick={clearSelection}
                        data-hidden={query ? "false" : "true"}
                        className="ec-collapse-toggle ec-icon-button inline-flex size-9 shrink-0 items-center justify-center text-black/60 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                        type="button"
                        aria-label="Clear search"
                        tabIndex={query ? 0 : -1}
                    >
                        <svg
                            viewBox="0 0 14 14"
                            aria-hidden="true"
                            className="size-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        >
                            <path d="M1 1L13 13M13 1L1 13" />
                        </svg>
                    </button>
                    {voiceAgentEnabled ? (
                        <VoiceAgentButton
                            buttonLabel="Talk to ExamCooker"
                            className="size-9 shrink-0"
                            iconClassName="size-4"
                            onClick={handleVoiceClick}
                            runtime={{
                                activity: "idle",
                                connected: false,
                                muted: false,
                            }}
                            variant="nav"
                        >
                        </VoiceAgentButton>
                    ) : null}
                </div>

                <Activity mode={dropdownVisible ? "visible" : "hidden"}>
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-[#0C1222] border border-black/15 dark:border-[#D5D5D5]/15 shadow-lg max-h-80 overflow-y-auto"
                    >
                        {filteredCourses.length > 0 ? (
                            filteredCourses.map((course, index) => (
                                <Link
                                    key={course.code}
                                    href={getCoursePastPapersPath(course.code)}
                                    prefetch
                                    transitionTypes={["nav-forward"]}
                                    onFocus={() => prefetch(getCoursePastPapersPath(course.code))}
                                    onPointerEnter={() => prefetch(getCoursePastPapersPath(course.code))}
                                    onClick={() => {
                                        recordCourseSelection(course, {
                                            interaction: "click",
                                            resultIndex: index,
                                        });
                                        closeSearchResultsSoon();
                                    }}
                                    style={{ ["--ec-row-index" as string]: index } as React.CSSProperties}
                                    className={`ec-row-reveal w-full px-4 py-3 text-left flex justify-between items-center gap-3 transition-colors border-b border-black/10 dark:border-[#D5D5D5]/15 last:border-b-0 hover:bg-[#5FC4E7]/25 dark:hover:bg-[#3BF4C7]/10 ${highlightedIndex === index
                                            ? 'bg-[#5FC4E7]/25 dark:bg-[#3BF4C7]/10'
                                            : ''
                                        }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-black dark:text-[#D5D5D5] truncate">
                                            {course.title}
                                        </div>
                                        <div className="text-xs uppercase tracking-wide text-black/60 dark:text-[#D5D5D5]/60 mt-0.5">
                                            {course.code}
                                        </div>
                                    </div>
                                    <div className="hidden sm:flex gap-1.5 shrink-0 text-[11px] font-semibold">
                                        {course.paperCount > 0 && (
                                            <span className="border border-black/40 dark:border-[#5FC4E7]/50 px-1.5 py-0.5 text-black/70 dark:text-[#5FC4E7]">
                                                {course.paperCount} papers
                                            </span>
                                        )}
                                        {course.noteCount > 0 && (
                                            <span className="border border-black/40 dark:border-[#3BF4C7]/50 px-1.5 py-0.5 text-black/70 dark:text-[#3BF4C7]">
                                                {course.noteCount} notes
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))
                        ) : query.trim() ? (
                            <div className="px-4 py-6 text-center text-sm text-black/60 dark:text-[#D5D5D5]/60">
                                No courses found for &quot;{query}&quot;
                            </div>
                        ) : null}
                    </div>
                </Activity>
            </div>

            <div className="mt-4 sm:mt-6 h-[10.75rem] sm:h-[8.75rem]" />
        </div>
    );
}
