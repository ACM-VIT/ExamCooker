import React from "react";
import Link from "next/link";
import type { UpcomingExamItem } from "@/lib/data/upcomingExams";

function MarqueeItem({
    item,
    prefetch,
}: {
    item: UpcomingExamItem;
    prefetch: boolean;
}) {
    return (
        <Link
            href={`/past_papers/${encodeURIComponent(item.courseCode)}`}
            prefetch={prefetch}
            transitionTypes={["nav-forward"]}
            className="group inline-flex items-center gap-3 whitespace-nowrap text-base text-black/75 transition-colors hover:text-[#253EE0] dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7] md:text-lg md:text-white/85 md:hover:text-[#3BF4C7] dark:md:text-white/85"
        >
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-black/55 dark:text-[#D5D5D5]/55 group-hover:text-current md:text-sm md:text-white/65 dark:md:text-white/65">
                {item.courseCode}
            </span>
            <span className="font-semibold underline-offset-4 decoration-1 group-hover:underline">
                {item.courseTitle}
            </span>
        </Link>
    );
}

function MarqueeRow({
    items,
    prefetch,
    reverse,
}: {
    items: UpcomingExamItem[];
    prefetch?: boolean;
    reverse?: boolean;
}) {
    const loop = (["base", "clone"] as const).flatMap((copy) =>
        items.map((item) => ({ item, copy })),
    );
    return (
        <div className="overflow-hidden">
            <div
                className={`flex w-max items-center gap-10 md:gap-14 ${
                    reverse ? "animate-marquee-reverse" : "animate-marquee"
                }`}
            >
                {loop.map(({ item, copy }) => (
                    <React.Fragment key={`${copy}-${item.id}`}>
                        <MarqueeItem item={item} prefetch={prefetch === true && copy === "base"} />
                        <span
                            aria-hidden="true"
                            className="select-none text-xs text-black/25 dark:text-[#D5D5D5]/20 md:text-white/30 dark:md:text-white/30"
                        >
                            ◆
                        </span>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

export default async function ExamsMarquee({ items }: { items: UpcomingExamItem[] }) {
    if (items.length === 0) return null;

    const mid = Math.ceil(items.length / 2);
    const rowA = items;
    const rowB = items.length > 3 ? [...items.slice(mid), ...items.slice(0, mid)] : items;

    return (
        <div
            role="region"
            aria-label="Upcoming exams"
            className="relative left-1/2 w-screen -translate-x-1/2 border-y border-black/10 py-4 md:py-5 dark:border-[#D5D5D5]/10 md:border-white/15 dark:md:border-white/15"
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#C2E6EC] to-transparent md:hidden md:w-32 dark:from-[hsl(224,48%,9%)] dark:md:block"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#C2E6EC] to-transparent md:hidden md:w-32 dark:from-[hsl(224,48%,9%)] dark:md:block"
            />
            <div className="flex flex-col gap-3 md:gap-4">
                <MarqueeRow items={rowA} prefetch />
                <MarqueeRow items={rowB} reverse />
            </div>
        </div>
    );
}
