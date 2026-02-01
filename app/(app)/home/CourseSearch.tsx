'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from "next/image";
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
        <div className="w-full max-w-2xl mx-auto">
            {/* Search Input */}
            <div className="relative">
                <div className="relative flex items-center bg-white dark:bg-[#1e2330] border-2 border-[#82BEE9] dark:border-[#D5D5D5] w-full px-4 py-1 shadow-[3px_3px_0_0_rgba(130,190,233,0.5)] dark:shadow-[3px_3px_0_0_rgba(213,213,213,0.3)] rounded-lg">
                    <Image src={SearchIcon} alt="search" className="dark:invert-[.835] w-5 h-5" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="px-4 py-3 w-full focus:outline-none bg-transparent text-lg placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        placeholder="Search for a course by code or title..."
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => query.trim() && setIsOpen(true)}
                    />
                    {query && (
                        <button
                            onClick={clearSelection}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                            type="button"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Dropdown Results */}
                {isOpen && filteredCourses.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-[#1a1f2e] border-2 border-black dark:border-[#D5D5D5] shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.3)] max-h-80 overflow-y-auto"
                    >
                        {filteredCourses.map((course, index) => (
                            <button
                                key={course.code}
                                onClick={() => handleSelectCourse(course)}
                                className={`w-full px-4 py-3 text-left flex justify-between items-center hover:bg-[#5FC4E7]/30 dark:hover:bg-[#3BF4C7]/20 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
                                    highlightedIndex === index ? 'bg-[#5FC4E7]/30 dark:bg-[#3BF4C7]/20' : ''
                                }`}
                            >
                                <div>
                                    <div className="font-semibold">{course.title}</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">{course.code}</div>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-3">
                                    {course.paperCount > 0 && (
                                        <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                                            {course.paperCount} papers
                                        </span>
                                    )}
                                    {course.noteCount > 0 && (
                                        <span className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
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
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-[#1a1f2e] border-2 border-black dark:border-[#D5D5D5] shadow-[3px_3px_0_0_rgba(0,0,0,1)] px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                        No courses found for &quot;{query}&quot;
                    </div>
                )}
            </div>

            {/* Selected Course Preview */}
            {selectedCourse && (
                <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="border border-[#82BEE9] dark:border-[#D5D5D5] rounded-lg p-5">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
                            <div>
                                <h3 className="text-lg font-bold">{selectedCourse.title}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedCourse.code}</p>
                            </div>
                            <Link
                                href={`/courses/${encodeURIComponent(selectedCourse.code)}`}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#E2E8F0] dark:bg-[#232530] border border-[#CBD5E1] dark:border-[#D5D5D5] rounded-lg text-sm font-medium hover:bg-[#CBD5E1] dark:hover:bg-[#2d323f] transition-colors"
                            >
                                View Full Course Page
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </Link>
                        </div>

                        <div className="flex flex-wrap gap-1 p-2 bg-[#E2E8F0] dark:bg-[#232530] rounded-lg justify-center items-center text-sm">
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

                                return actions.map((action, idx) => (
                                    <React.Fragment key={action.href}>
                                        <Link
                                            href={action.href}
                                            className="px-2 py-1 hover:bg-white/20 rounded"
                                        >
                                            {action.label}
                                        </Link>
                                        {idx < actions.length - 1 ? (
                                            <span className="text-gray-500 dark:text-gray-400">|</span>
                                        ) : null}
                                    </React.Fragment>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
