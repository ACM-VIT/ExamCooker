"use client";

import { memo } from "react";
import Link from "next/link";
import type { VinCourse } from "@/lib/data/vin-together";

type ResourceCourseCardProps = {
    course: Pick<
        VinCourse,
        "id" | "slug" | "displayName" | "shortName" | "year" | "image" | "counts"
    >;
};

const formatCount = (count: number) => Intl.NumberFormat("en-IN").format(count);

function ResourceCourseCard({ course }: ResourceCourseCardProps) {
    const href = `/resources/${course.slug}`;
    const totalVideos = course.counts.videoCount + course.counts.exampleVideoCount;

    return (
        <div className="group relative h-full">
            <Link
                href={href}
                prefetch
                transitionTypes={["nav-forward"]}
                className="flex h-full flex-col gap-3 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 text-black transition duration-200 hover:scale-[1.03] hover:shadow-xl hover:border-b-2 hover:border-b-white dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222] dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10"
            >
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center bg-black/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black/60 dark:bg-[#D5D5D5]/10 dark:text-[#D5D5D5]/60">
                        {course.year}
                    </span>
                    {course.shortName && (
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/55 dark:text-[#D5D5D5]/55">
                            {course.shortName}
                        </span>
                    )}
                </div>

                <h3 className="line-clamp-3 text-base font-bold leading-snug text-black dark:text-[#D5D5D5]">
                    {course.displayName}
                </h3>

                <div className="mt-auto flex items-end justify-between pt-1">
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold leading-none text-black dark:text-[#D5D5D5]">
                            {formatCount(course.counts.moduleCount)}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                            module{course.counts.moduleCount === 1 ? "" : "s"}
                        </span>
                    </div>
                    {totalVideos > 0 && (
                        <span className="hidden text-[10px] font-semibold text-black/55 dark:text-[#D5D5D5]/55 sm:inline">
                            +{formatCount(totalVideos)} video{totalVideos === 1 ? "" : "s"}
                        </span>
                    )}
                </div>
            </Link>
        </div>
    );
}

export default memo(ResourceCourseCard);
