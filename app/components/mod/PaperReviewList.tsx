"use client";

import React, { useMemo, useState } from "react";
import PaperReviewRow, { type PaperRowData } from "./PaperReviewRow";
import type { CourseOption } from "./CoursePicker";

type Props = {
    initialPapers: PaperRowData[];
    courses: CourseOption[];
};

export default function PaperReviewList({ initialPapers, courses }: Props) {
    const [papers, setPapers] = useState(initialPapers);
    const [filter, setFilter] = useState<
        "all" | "no_course" | "no_exam" | "no_year"
    >("all");

    const filtered = useMemo(() => {
        switch (filter) {
            case "no_course":
                return papers.filter((p) => p.courseId === null);
            case "no_exam":
                return papers.filter((p) => p.examType === null);
            case "no_year":
                return papers.filter((p) => p.year === null);
            default:
                return papers;
        }
    }, [papers, filter]);

    const onResolved = (id: string) => {
        setPapers((prev) => prev.filter((p) => p.id !== id));
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
                            ["no_course", "No course"],
                            ["no_exam", "No exam"],
                            ["no_year", "No year"],
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
                        courses={courses}
                        onResolved={onResolved}
                    />
                ))}
            </div>
        </div>
    );
}
