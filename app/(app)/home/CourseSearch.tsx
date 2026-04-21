'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from "@/app/components/common/AppImage";
import Link from "next/link";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import { getAliasCourseCodes } from "@/lib/courseAliases";

export type CourseResult = {
    code: string;
    title: string;
    noteCount: number;
    paperCount: number;
};

interface CourseSearchProps {
    courses: CourseResult[];
}

export default function CourseSearch({ courses }: CourseSearchProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<CourseResult | null>(null);
    const [syllabusId, setSyllabusId] = useState<string | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredCourses = useMemo(() => {
        const trimmed = query.trim();
        if (!trimmed) return [];
        const lowerQuery = trimmed.toLowerCase();
        const aliasCodes = getAliasCourseCodes(trimmed);
        const aliasSet = new Set(aliasCodes.map((code) => code.toUpperCase()));
        return courses
            .filter(course => {
                const codeUpper = course.code.toUpperCase();
                if (aliasSet.has(codeUpper)) return true;
                return (
                    course.code.toLowerCase().includes(lowerQuery) ||
                    course.title.toLowerCase().includes(lowerQuery)
                );
            })
            .slice(0, 8);
    }, [query, courses]);

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

    useEffect(() => {
        if (!selectedCourse?.code) {
            setSyllabusId(null);
            return;
        }

        const controller = new AbortController();

        (async () => {
            try {
                const res = await fetch(
                    `/api/syllabus/by-course/${encodeURIComponent(selectedCourse.code)}`,
                    { signal: controller.signal }
                );
                if (!res.ok) {
                    setSyllabusId(null);
                    return;
                }
                const data: { id: string | null } = await res.json();
                setSyllabusId(data.id ?? null);
            } catch (err) {
                if ((err as { name?: string })?.name === 'AbortError') return;
                setSyllabusId(null);
            }
        })();

        return () => controller.abort();
    }, [selectedCourse?.code]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        setIsOpen(value.trim().length > 0);
        setHighlightedIndex(-1);
        if (selectedCourse && value !== `${selectedCourse.title} (${selectedCourse.code})`) {
            setSelectedCourse(null);
        }
    };

    const handleSelectCourse = (course: CourseResult) => {
        setSelectedCourse(course);
        setSyllabusId(null);
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
            handleSelectCourse(filteredCourses[highlightedIndex]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const clearSelection = () => {
        setQuery('');
        setSelectedCourse(null);
        setSyllabusId(null);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    return (
        <div className="w-full max-w-2xl mx-auto text-left">
            <div className="relative">
                <div className="relative flex items-center bg-white dark:bg-[#3D414E] border border-black dark:border-[#D5D5D5] w-full px-2 py-0.5 shadow-[2px_2px_0_0_rgba(0,0,0,1)] dark:shadow-[2px_2px_0_0_rgba(213,213,213,0.4)]">
                    <Image src={SearchIcon} alt="search" className="dark:invert-[.835]" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="px-4 py-2 w-full focus:outline-none bg-transparent text-black dark:text-[#D5D5D5] placeholder:text-black/50 dark:placeholder:text-[#D5D5D5]/60"
                        placeholder="Search for a course by code or title..."
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => query.trim() && setIsOpen(true)}
                    />
                    {query && (
                        <button
                            onClick={clearSelection}
                            className="inline-flex h-7 w-7 items-center justify-center text-black/60 transition-colors hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                            type="button"
                            aria-label="Clear search"
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

                {isOpen && filteredCourses.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-[#0C1222] border-2 border-black dark:border-[#D5D5D5] shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(59,244,199,0.35)] max-h-80 overflow-y-auto"
                    >
                        {filteredCourses.map((course, index) => (
                            <button
                                key={course.code}
                                onClick={() => handleSelectCourse(course)}
                                className={`w-full px-4 py-3 text-left flex justify-between items-center gap-3 transition-colors border-b border-black/10 dark:border-[#D5D5D5]/15 last:border-b-0 hover:bg-[#5FC4E7]/25 dark:hover:bg-[#3BF4C7]/10 ${
                                    highlightedIndex === index
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
                                <div className="flex gap-1.5 shrink-0 text-[11px] font-semibold">
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
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-[#0C1222] border-2 border-black dark:border-[#D5D5D5] shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(59,244,199,0.35)] px-4 py-6 text-center text-sm text-black/60 dark:text-[#D5D5D5]/60"
                    >
                        No courses found for &quot;{query}&quot;
                    </div>
                )}
            </div>

            {selectedCourse && (
                <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="border-2 border-black bg-white text-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[4px_4px_0_0_rgba(59,244,199,0.35)]">
                        <div className="flex flex-col gap-3 border-b border-black/15 dark:border-[#D5D5D5]/15 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-black/55 dark:text-[#3BF4C7]/80">
                                    {selectedCourse.code}
                                </p>
                                <h3 className="mt-1 text-lg font-bold leading-snug">
                                    {selectedCourse.title}
                                </h3>
                            </div>
                            <Link
                                href={`/courses/${encodeURIComponent(selectedCourse.code)}`}
                                className="group inline-flex h-10 shrink-0 items-center justify-center gap-2 border-2 border-black bg-[#3BF4C7] px-4 text-sm font-bold text-black transition duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7] dark:hover:text-[#3BF4C7]"
                            >
                                View full course
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </Link>
                        </div>

                        {(() => {
                            const actions: Array<{ href: string; label: string }> = [];

                            if (selectedCourse.paperCount > 0) {
                                actions.push({
                                    href: `/past_papers?search=${encodeURIComponent(selectedCourse.code)}`,
                                    label: `Past Papers (${selectedCourse.paperCount})`,
                                });
                            }

                            if (selectedCourse.noteCount > 0) {
                                actions.push({
                                    href: `/notes?search=${encodeURIComponent(selectedCourse.code)}`,
                                    label: `Notes (${selectedCourse.noteCount})`,
                                });
                            }

                            if (syllabusId) {
                                actions.push({
                                    href: `/syllabus/${encodeURIComponent(syllabusId)}`,
                                    label: 'Syllabus',
                                });
                            }

                            if (actions.length === 0) {
                                return (
                                    <p className="px-5 py-4 text-center text-sm text-black/55 dark:text-[#D5D5D5]/55">
                                        No resources yet for this course.
                                    </p>
                                );
                            }

                            return (
                                <div className="flex flex-wrap gap-2 p-3 sm:p-4">
                                    {actions.map((action) => (
                                        <Link
                                            key={action.href}
                                            href={action.href}
                                            className="inline-flex h-9 items-center justify-center border border-black/70 px-3 text-sm font-semibold text-black transition-colors hover:bg-[#5FC4E7]/25 dark:border-[#D5D5D5]/60 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7] dark:hover:bg-[#3BF4C7]/10 dark:hover:text-[#3BF4C7]"
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
    );
}
