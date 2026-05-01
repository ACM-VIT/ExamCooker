import React from "react";
import Link from "next/link";
import Image from "@/app/components/common/app-image";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import { examTypeLabel } from "@/lib/exam-slug";
import type { ExamType } from "@/db";
import { getPastPaperDetailPath } from "@/lib/seo";

type RecentItem = {
    id: string;
    title: string;
    thumbNailUrl: string | null;
    courseCode: string | null;
    courseTitle: string | null;
    examType: ExamType | string | null;
    slot: string | null;
    year: number | null;
};

export default function RecentPaperStrip({
    items,
    title = "Recently added",
}: {
    items: RecentItem[];
    title?: string;
}) {
    if (items.length === 0) return null;
    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-end justify-between">
                <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                    {title}
                </h2>
            </header>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
                {items.map((item, i) => {
                    const href = getPastPaperDetailPath(item.id, item.courseCode);
                    const thumb = normalizeGcsUrl(item.thumbNailUrl);
                    return (
                        <Link
                            key={item.id}
                            href={href}
                            prefetch={i < 3}
                            transitionTypes={["nav-forward"]}
                            className="group relative flex w-40 shrink-0 snap-start flex-col overflow-hidden border-2 border-[#5FC4E7] bg-[#5FC4E7] text-black transition duration-200 hover:scale-[1.02] hover:border-b-white hover:shadow-xl dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222] dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10 sm:w-44"
                        >
                            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#d9d9d9] dark:bg-white/5">
                                <Image
                                    src={thumb || "/assets/exam-cooker.png"}
                                    alt={item.title}
                                    fill
                                    sizes="(min-width: 640px) 176px, 160px"
                                    className="object-cover"
                                    priority={i < 3}
                                />
                            </div>
                            <div className="flex min-h-[5.75rem] flex-1 flex-col gap-1 p-2.5 text-black dark:text-[#D5D5D5]">
                                {item.courseCode && (
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-black/70 dark:text-[#D5D5D5]/70">
                                        {item.courseCode}
                                    </span>
                                )}
                                <p className="line-clamp-2 text-xs font-semibold">
                                    {item.courseTitle ?? item.title}
                                </p>
                                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-black/70 dark:text-[#D5D5D5]/70">
                                    {item.examType && (
                                        <span className="bg-black/10 px-1.5 py-0.5 text-black/80 dark:bg-[#D5D5D5]/15 dark:text-[#D5D5D5]/90">
                                            {examTypeLabel(item.examType as ExamType)}
                                        </span>
                                    )}
                                    {item.slot && (
                                        <span className="bg-black/10 px-1.5 py-0.5 text-black/80 dark:bg-[#D5D5D5]/15 dark:text-[#D5D5D5]/90">
                                            {item.slot}
                                        </span>
                                    )}
                                    {item.year !== null && (
                                        <span className="bg-black/10 px-1.5 py-0.5 text-black/80 dark:bg-[#D5D5D5]/15 dark:text-[#D5D5D5]/90">
                                            {item.year}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
