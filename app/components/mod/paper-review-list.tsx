"use client";

import React, { useMemo, useRef, useState } from "react";
import PaperReviewRow, { type PaperRowData } from "./paper-review-row";
import type { CourseOption } from "./course-picker";

type Props = {
    initialPapers: PaperRowData[];
    courses: CourseOption[];
};

export default function PaperReviewList({ initialPapers, courses }: Props) {
    const initialPapersRef = useRef(initialPapers);
    const initialCoursesRef = useRef(courses);
    const [papers, setPapers] = useState(initialPapersRef.current);
    const [courseOptions, setCourseOptions] = useState(initialCoursesRef.current);
    const [filter, setFilter] = useState<
        "all" | "uncleared" | "no_course" | "no_exam" | "no_year" | "needs_link"
    >("all");

    const filtered = useMemo(() => {
        switch (filter) {
            case "uncleared":
                return papers.filter((p) => !p.isClear);
            case "no_course":
                return papers.filter((p) => p.courseId === null);
            case "no_exam":
                return papers.filter((p) => p.examType === null);
            case "no_year":
                return papers.filter((p) => p.year === null);
            case "needs_link":
                return papers.filter((p) => p.hasAnswerKey && p.questionPaper === null);
            default:
                return papers;
        }
    }, [papers, filter]);

    const onResolved = (id: string) => {
        setPapers((prev) => prev.filter((p) => p.id !== id));
    };

    const onCourseCreated = (course: CourseOption) => {
        setCourseOptions((prev) => {
            if (prev.some((c) => c.id === course.id || c.code === course.code)) return prev;
            return [...prev, course].sort((a, b) => a.code.localeCompare(b.code));
        });
    };

    if (papers.length === 0) {
        return (
            <div className="border-2 border-dashed border-black/20 dark:border-[#D5D5D5]/20 p-8 text-center text-black/60 dark:text-[#D5D5D5]/60">
                No papers in the review queue. Nicely done.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                    {filtered.length} of {papers.length} shown
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                    {(
                        [
                            ["all", "All"],
                            ["uncleared", "Uncleared"],
                            ["no_course", "No course"],
                            ["no_exam", "No exam"],
                            ["no_year", "No year"],
                            ["needs_link", "Needs link"],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setFilter(key)}
                            className={`border px-3 py-1 text-xs font-semibold transition ${
                                filter === key
                                    ? "border-black bg-[#5FC4E7] text-black dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7]"
                                    : "border-black/30 text-black hover:bg-black/5 dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {filtered.map((paper) => (
                    <PaperReviewRow
                        key={paper.id}
                        paper={paper}
                        courses={courseOptions}
                        onResolved={onResolved}
                        onCourseCreated={onCourseCreated}
                    />
                ))}
            </div>
        </div>
    );
}
