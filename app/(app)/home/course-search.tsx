'use client';

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Image from "@/app/components/common/app-image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import { getAliasCourseCodes } from "@/lib/course-aliases";
import { normalizeCourseCode } from "@/lib/course-tags";
import {
    captureCourseSearchDestinationClicked,
    captureCourseSearchSelection,
    type CourseSearchInteraction,
    type VoiceAgentEntryPoint,
} from "@/lib/posthog/client";
import { POSTHOG_FEATURE_FLAGS } from "@/lib/posthog/shared";
import { usePostHogFeatureFlagEnabled } from "@/lib/posthog/use-feature-flag-enabled";
import {
    getCourseNotesPath,
    getCoursePastPapersPath,
    getCourseSyllabusPath,
} from "@/lib/seo";

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

export default function CourseSearch({ courses }: CourseSearchProps) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<CourseResult | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const deferredQuery = useDeferredValue(query);
    const voiceAgentEnabled =
        usePostHogFeatureFlagEnabled(POSTHOG_FEATURE_FLAGS.voiceAgent) ?? true;

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

        return searchableCourses
            .filter(({ codeUpper, normalizedSearchable }) => {
                if (aliasSet.has(codeUpper) || codeUpper === normalizedCodeQuery) return true;
                return queryTerms.every((term) => normalizedSearchable.includes(term));
            })
            .map(({ course }) => course)
            .slice(0, 8);
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

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        setIsOpen(value.trim().length > 0);
        setHighlightedIndex(-1);
        if (selectedCourse && value !== `${selectedCourse.title} (${selectedCourse.code})`) {
            setSelectedCourse(null);
        }
    };

    const handleSelectCourse = (
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

        captureCourseSearchSelection({
            context: "home",
            interaction,
            courseCode: course.code,
            resultCount: filteredCourses.length,
            resultIndex: options?.resultIndex,
            paperCount: course.paperCount,
            noteCount: course.noteCount,
            hasSyllabus: Boolean(course.syllabusId),
        });

        if (isMobile) {
            setIsOpen(false);
            setHighlightedIndex(-1);
            router.push(getCoursePastPapersPath(course.code));
            return;
        }

        setSelectedCourse(course);
        setQuery(`${course.title} (${course.code})`);
        setIsOpen(false);
        setHighlightedIndex(-1);
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
        setSelectedCourse(null);
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

    return (
        <div className="mx-auto w-full min-w-0 text-left">
            <div className="relative">
                <div className="relative flex h-12 sm:h-14 lg:h-16 w-full min-w-0 items-center overflow-hidden bg-white pl-4 pr-2 dark:bg-[#3D414E] border border-black/25 dark:border-[#D5D5D5]/30">
                    <Image src={SearchIcon} alt="search" className="dark:invert-[.835] h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="h-full min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent px-3 text-sm text-black focus:outline-none placeholder:text-black/50 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/60 sm:px-4 sm:text-base lg:text-lg"
                        placeholder="Search for a course..."
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => query.trim() && setIsOpen(true)}
                    />
                    <button
                        onClick={clearSelection}
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center text-black/60 transition-colors hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7] ${query ? "visible" : "invisible pointer-events-none w-0 overflow-hidden"
                            }`}
                        type="button"
                        aria-label="Clear search"
                        tabIndex={query ? 0 : -1}
                    >
                        <svg
                            viewBox="0 0 14 14"
                            aria-hidden="true"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        >
                            <path d="M1 1L13 13M13 1L1 13" />
                        </svg>
                    </button>
                    {voiceAgentEnabled ? (
                        <button
                            onClick={handleVoiceClick}
                            type="button"
                            aria-label="Talk to ExamCooker"
                            title="Talk to ExamCooker"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-black/60 transition-colors hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                        >
                            <Mic className="h-4 w-4" aria-hidden="true" />
                        </button>
                    ) : null}
                </div>

                {isOpen && filteredCourses.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-[#0C1222] border border-black/15 dark:border-[#D5D5D5]/15 shadow-lg max-h-80 overflow-y-auto"
                    >
                        {filteredCourses.map((course, index) => (
                            <button
                                key={course.code}
                                onClick={() =>
                                    handleSelectCourse(course, {
                                        interaction: "click",
                                        resultIndex: index,
                                    })
                                }
                                className={`w-full px-4 py-3 text-left flex justify-between items-center gap-3 transition-colors border-b border-black/10 dark:border-[#D5D5D5]/15 last:border-b-0 hover:bg-[#5FC4E7]/25 dark:hover:bg-[#3BF4C7]/10 ${highlightedIndex === index
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
                            </button>
                        ))}
                    </div>
                )}

                {isOpen && query.trim() && filteredCourses.length === 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-[#0C1222] border border-black/15 dark:border-[#D5D5D5]/15 shadow-lg px-4 py-6 text-center text-sm text-black/60 dark:text-[#D5D5D5]/60"
                    >
                        No courses found for &quot;{query}&quot;
                    </div>
                )}
            </div>

            <div className="mt-4 sm:mt-6 h-[10.75rem] sm:h-[8.75rem]">
                {selectedCourse && (
                    <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex h-full min-w-0 flex-col overflow-hidden border border-black/20 bg-white text-black dark:border-[#D5D5D5]/20 dark:bg-[#0C1222] dark:text-[#D5D5D5]">
                            <div className="min-h-0 min-w-0 flex-1 overflow-hidden border-b border-black/15 p-5 dark:border-[#D5D5D5]/15">
                                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-black/55 dark:text-[#3BF4C7]/80">
                                    {selectedCourse.code}
                                </p>
                                <h3 className="mt-1 block max-w-full truncate text-lg font-bold leading-snug">
                                    {selectedCourse.title}
                                </h3>
                            </div>

                            {(() => {
                                const actions: Array<{
                                    href: string;
                                    label: string;
                                    destination: "past_papers" | "notes" | "syllabus";
                                }> = [];

                                if (selectedCourse.paperCount > 0) {
                                    actions.push({
                                        href: getCoursePastPapersPath(selectedCourse.code),
                                        label: `Past Papers (${selectedCourse.paperCount})`,
                                        destination: "past_papers",
                                    });
                                }

                                if (selectedCourse.noteCount > 0) {
                                    actions.push({
                                        href: getCourseNotesPath(selectedCourse.code),
                                        label: `Notes (${selectedCourse.noteCount})`,
                                        destination: "notes",
                                    });
                                }

                                if (selectedCourse.syllabusId) {
                                    actions.push({
                                        href: getCourseSyllabusPath(selectedCourse.code),
                                        label: 'Syllabus',
                                        destination: "syllabus",
                                    });
                                }

                                if (actions.length === 0) {
                                    return (
                                        <p className="shrink-0 px-5 py-4 text-center text-sm text-black/55 dark:text-[#D5D5D5]/55">
                                            No resources yet for this course.
                                        </p>
                                    );
                                }

                                return (
                                    <div className="flex shrink-0 gap-2 overflow-x-auto p-3 sm:p-4">
                                        {actions.map((action) => (
                                            <Link
                                                key={action.href}
                                                href={action.href}
                                                onClick={() =>
                                                    captureCourseSearchDestinationClicked({
                                                        context: "home",
                                                        courseCode: selectedCourse.code,
                                                        destination: action.destination,
                                                    })
                                                }
                                                className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap border border-black/70 px-3 text-sm font-semibold text-black transition-colors hover:bg-[#5FC4E7]/25 dark:border-[#D5D5D5]/60 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7] dark:hover:bg-[#3BF4C7]/10 dark:hover:text-[#3BF4C7]"
                                            >
                                                {action.label}
                                            </Link>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
