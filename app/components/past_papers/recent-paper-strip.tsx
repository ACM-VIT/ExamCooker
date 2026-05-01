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
                            className="group relative flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-md border border-black/10 bg-white transition-all duration-200 hover:border-black/30 hover:shadow-md dark:border-[#D5D5D5]/10 dark:bg-[#0C1222] dark:hover:border-[#D5D5D5]/35 dark:hover:shadow-[0_4px_18px_rgba(59,244,199,0.08)] sm:w-44"
                        >
                            <div className="relative aspect-[4/5] w-full overflow-hidden bg-black/5 dark:bg-white/5">
                                <Image
                                    src={thumb || "/assets/exam-cooker.png"}
                                    alt={item.title}
                                    fill
                                    sizes="(min-width: 640px) 176px, 160px"
                                    className="object-cover"
                                    priority={i < 3}
                                />
                            </div>
                            <div className="flex flex-col gap-1 p-2.5 text-black dark:text-[#D5D5D5]">
                                {item.courseCode && (
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-black/70 dark:text-[#3BF4C7]/80">
                                        {item.courseCode}
                                    </span>
                                )}
                                <p className="line-clamp-2 text-xs font-semibold">
                                    {item.courseTitle ?? item.title}
                                </p>
                                <div className="flex items-center gap-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60">
                                    {item.examType && (
                                        <span>{examTypeLabel(item.examType as ExamType)}</span>
                                    )}
                                    {item.year !== null && <span>{item.year}</span>}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
