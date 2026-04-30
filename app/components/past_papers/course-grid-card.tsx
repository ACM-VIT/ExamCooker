import React from "react";
import Link from "next/link";

type Props = {
    course: {
        code: string;
        title: string;
        paperCount: number;
        noteCount: number;
    };
};

export default function CourseGridCard({ course }: Props) {
    return (
        <div className="group relative h-full">
            <Link
                href={`/past_papers/${encodeURIComponent(course.code)}`}
                prefetch
                transitionTypes={["nav-forward"]}
                className="flex h-full flex-col gap-3 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 text-black transition duration-200 hover:scale-[1.03] hover:shadow-xl hover:border-b-2 hover:border-b-white dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222] dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10"
            >
                <span className="font-mono text-xs font-bold uppercase tracking-wide text-black/75 dark:text-[#D5D5D5]/70">
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
                </div>
            </Link>
        </div>
    );
}
