"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbtack } from "@fortawesome/free-solid-svg-icons";
import PinButton from "./PinButton";
import { usePinnedCourses } from "./usePinnedCourses";

export type PinnedStripCourse = {
    code: string;
    title: string;
    paperCount: number;
    noteCount: number;
};

type Props = {
    courses: PinnedStripCourse[];
    heading?: string;
    emptyPrompt?: string;
};

export default function PinnedStrip({
    courses,
    heading = "Pinned",
    emptyPrompt = "Pin your courses to see them here for one-tap access.",
}: Props) {
    const { pinned, mounted } = usePinnedCourses();

    const byCode = useMemo(() => {
        const map = new Map<string, PinnedStripCourse>();
        for (const c of courses) map.set(c.code, c);
        return map;
    }, [courses]);

    const items = useMemo(
        () =>
            pinned
                .map((code) => byCode.get(code))
                .filter((c): c is PinnedStripCourse => Boolean(c)),
        [pinned, byCode],
    );

    if (!mounted) return null;

    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-center gap-2">
                <FontAwesomeIcon
                    icon={faThumbtack}
                    className={`h-3 w-3 ${
                        items.length > 0
                            ? "text-[#5FC4E7] dark:text-[#3BF4C7]"
                            : "-rotate-45 text-black/55 dark:text-[#D5D5D5]/55"
                    }`}
                />
                <h2 className="text-xs font-bold uppercase tracking-widest text-black/70 dark:text-[#D5D5D5]/70">
                    {heading}
                </h2>
                {items.length > 0 && (
                    <span className="text-xs text-black/50 dark:text-[#D5D5D5]/50">
                        {items.length}
                    </span>
                )}
            </header>

            {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-black/15 bg-white/50 px-4 py-5 text-center text-sm text-black/60 dark:border-[#D5D5D5]/15 dark:bg-white/5 dark:text-[#D5D5D5]/60">
                    {emptyPrompt}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {items.map((course) => (
                        <div key={course.code} className="group relative h-full">
                            <Link
                                href={`/past_papers/${encodeURIComponent(course.code)}`}
                                className="flex h-full flex-col gap-3 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 pr-10 text-black transition duration-200 hover:scale-[1.03] hover:shadow-xl hover:border-b-2 hover:border-b-white dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222] dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10"
                            >
                                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-black/55 dark:text-[#D5D5D5]/55">
                                    {course.code}
                                </span>
                                <h3 className="line-clamp-3 text-base font-bold leading-snug text-black dark:text-[#D5D5D5]">
                                    {course.title}
                                </h3>
                                <div className="mt-auto flex items-end justify-between pt-1">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-bold leading-none text-black dark:text-[#D5D5D5]">
                                            {course.paperCount}
                                        </span>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                                            paper{course.paperCount === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                    {course.noteCount > 0 && (
                                        <span className="hidden text-[10px] font-semibold text-black/55 dark:text-[#D5D5D5]/55 sm:inline">
                                            +{course.noteCount} note{course.noteCount === 1 ? "" : "s"}
                                        </span>
                                    )}
                                </div>
                            </Link>
                            <div className="absolute right-2 top-2">
                                <PinButton code={course.code} size="sm" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
