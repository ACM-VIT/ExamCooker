import React from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faBookOpen } from "@fortawesome/free-solid-svg-icons";
import TopBreadcrumbBar from "@/app/components/common/top-breadcrumb-bar";
import { getCourseNotesPath, getCourseSyllabusPath } from "@/lib/seo";

type Props = {
    code: string;
    title: string;
    paperCount: number;
    noteCount: number;
    syllabusId: string | null;
};

export default function CourseHeader({
    code,
    title,
    paperCount,
    noteCount,
    syllabusId,
}: Props) {
    return (
        <header className="flex flex-col gap-4">
            <TopBreadcrumbBar
                items={[
                    { label: "Past papers", href: "/past_papers" },
                    { label: code },
                ]}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 sm:flex-1">
                    <h1 className="min-w-0 text-pretty text-[1.08rem] font-bold leading-[1.08] text-black dark:text-[#D5D5D5] min-[360px]:text-[1.18rem] min-[400px]:text-[1.28rem] sm:text-3xl lg:text-4xl">
                        {title}
                    </h1>
                    <p className="mt-1 text-sm text-black/60 dark:text-[#D5D5D5]/60">
                        <span className="font-bold text-black dark:text-[#D5D5D5]">
                            {paperCount}
                        </span>{" "}
                        paper{paperCount === 1 ? "" : "s"}
                        {noteCount > 0 && (
                            <>
                                <span className="mx-1.5" aria-hidden="true">
                                    ·
                                </span>
                                <span className="font-bold text-black dark:text-[#D5D5D5]">
                                    {noteCount}
                                </span>{" "}
                                note{noteCount === 1 ? "" : "s"}
                            </>
                        )}
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:shrink-0 sm:flex-wrap sm:items-center sm:justify-end sm:gap-1.5">
                    {noteCount > 0 && (
                        <Link
                            href={getCourseNotesPath(code)}
                            className="inline-flex h-9 items-center justify-center gap-1.5 border border-black/15 px-3 font-semibold text-black transition-colors hover:border-black/30 hover:bg-black/5 dark:border-[#D5D5D5]/15 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/50 dark:hover:bg-white/5 sm:h-8"
                        >
                            <FontAwesomeIcon icon={faFileLines} className="h-3 w-3" />
                            Notes
                        </Link>
                    )}
                    {syllabusId && (
                        <Link
                            href={getCourseSyllabusPath(code)}
                            className="inline-flex h-9 items-center justify-center gap-1.5 border border-black/15 px-3 font-semibold text-black transition-colors hover:border-black/30 hover:bg-black/5 dark:border-[#D5D5D5]/15 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/50 dark:hover:bg-white/5 sm:h-8"
                        >
                            <FontAwesomeIcon icon={faBookOpen} className="h-3 w-3" />
                            Syllabus
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
