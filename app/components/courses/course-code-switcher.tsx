"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CourseTitleVariant } from "@/lib/data/course-catalog";
import { getCourseNotesPath, getCoursePastPapersPath } from "@/lib/seo";

type Props = {
    currentCode: string;
    courseTitle: string;
    courses: CourseTitleVariant[];
    surface?: "notes" | "papers";
};

function countLabel(count: number, singular: string) {
    return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export default function CourseCodeSwitcher({
    currentCode,
    courseTitle,
    courses,
    surface = "papers",
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const hasAlternatives = courses.some((course) => course.code !== currentCode);

    useEffect(() => {
        if (!isOpen) return;

        function handlePointerDown(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key !== "Escape") return;
            setIsOpen(false);
            triggerRef.current?.focus();
        }

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const codeLabel = (
        <>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/45">
                Course
            </span>
            <span className="font-mono text-xs font-bold tracking-wide">{currentCode}</span>
        </>
    );

    if (!hasAlternatives) {
        return (
            <div className="inline-flex h-8 items-center gap-2 border border-black/15 px-2.5 text-black dark:border-[#D5D5D5]/15 dark:text-[#D5D5D5]">
                {codeLabel}
            </div>
        );
    }

    return (
        <div ref={rootRef} className="relative z-30">
            <button
                ref={triggerRef}
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-label={`Change course code. ${currentCode} selected; ${courses.length} codes available for ${courseTitle}.`}
                onClick={() => setIsOpen((open) => !open)}
                className="inline-flex h-8 items-center gap-2 border border-black/15 px-2.5 text-black transition-colors hover:border-black/30 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 dark:border-[#D5D5D5]/15 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/50 dark:hover:bg-white/5 dark:focus-visible:ring-[#3BF4C7]"
            >
                {codeLabel}
                <span className="border-l border-black/15 pl-2 text-[10px] font-semibold text-black/55 dark:border-[#D5D5D5]/15 dark:text-[#D5D5D5]/55">
                    {courses.length} codes
                </span>
                <ChevronDown
                    className={`size-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden
                />
            </button>

            {isOpen && (
                <div
                    aria-label={`Course codes for ${courseTitle}`}
                    className="absolute left-0 top-full mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden border border-black/15 bg-white text-black shadow-[0_18px_45px_rgba(15,23,42,0.18)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
                >
                    <p className="border-b border-black/10 px-3 py-2.5 text-xs font-bold dark:border-[#D5D5D5]/10">
                        Same course, different codes
                    </p>

                    <div className="max-h-72 overflow-y-auto p-1.5">
                        {courses.map((course) => {
                            const isCurrent = course.code === currentCode;
                            const content = (
                                <>
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span className="inline-flex size-5 shrink-0 items-center justify-center">
                                            {isCurrent ? (
                                                <Check
                                                    className="size-3.5 text-black dark:text-[#3BF4C7]"
                                                    aria-hidden
                                                />
                                            ) : null}
                                        </span>
                                        <span className="font-mono text-xs font-bold tracking-wide">
                                            {course.code}
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2 text-[10px] font-semibold text-black/55 dark:text-[#D5D5D5]/55">
                                        <span>{countLabel(course.paperCount, "paper")}</span>
                                        <span aria-hidden>·</span>
                                        <span>{countLabel(course.noteCount, "note")}</span>
                                    </span>
                                </>
                            );

                            return isCurrent ? (
                                <div
                                    key={course.id}
                                    aria-current="page"
                                    aria-label={`${course.code}, current course code`}
                                    className="flex min-h-10 items-center justify-between gap-3 bg-[#5FC4E7]/30 px-2.5 py-2 dark:bg-[#3BF4C7]/10"
                                >
                                    {content}
                                </div>
                            ) : (
                                <Link
                                    key={course.id}
                                    href={
                                        surface === "notes"
                                            ? getCourseNotesPath(course.code)
                                            : getCoursePastPapersPath(course.code)
                                    }
                                    onClick={() => setIsOpen(false)}
                                    className="flex min-h-10 items-center justify-between gap-3 px-2.5 py-2 transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline-none dark:hover:bg-white/[0.06] dark:focus-visible:bg-white/[0.06]"
                                >
                                    {content}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
