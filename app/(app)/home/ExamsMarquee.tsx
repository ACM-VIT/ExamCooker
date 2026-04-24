import React from "react";
import Link from "next/link";
import { connection } from "next/server";
import type { UpcomingExamItem } from "@/lib/data/upcomingExams";

function formatWhen(date: Date | null): string {
    if (!date) return "unscheduled";
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 0) return "today";
    if (days === 1) return "tomorrow";
    if (days <= 14) return `in ${days} days`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MarqueeItem({ item }: { item: UpcomingExamItem }) {
    const when = formatWhen(item.scheduledAt);
    return (
        <Link
            href={`/past_papers/${encodeURIComponent(item.courseCode)}`}
            prefetch
            transitionTypes={["nav-forward"]}
            className="group inline-flex items-center gap-3 whitespace-nowrap text-base text-black/75 transition-colors hover:text-[#253EE0] dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7] md:text-lg"
        >
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-black/55 dark:text-[#D5D5D5]/55 group-hover:text-current md:text-sm">
                {item.courseCode}
            </span>
            <span className="font-semibold underline-offset-4 decoration-1 group-hover:underline">
                {item.courseTitle}
            </span>
            <span className="text-xs tracking-wide text-black/45 dark:text-[#D5D5D5]/45 group-hover:text-current md:text-sm">
                — {when}
            </span>
        </Link>
    );
}

function MarqueeRow({
    items,
    reverse,
}: {
    items: UpcomingExamItem[];
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
                        <MarqueeItem item={item} />
                        <span
                            aria-hidden="true"
                            className="select-none text-xs text-black/25 dark:text-[#D5D5D5]/20"
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
    await connection();

    if (items.length === 0) return null;

    const mid = Math.ceil(items.length / 2);
    const rowA = items;
    const rowB = items.length > 3 ? [...items.slice(mid), ...items.slice(0, mid)] : items;

    return (
        <div
            role="region"
            aria-label="Upcoming exams"
            className="relative left-1/2 w-screen -translate-x-1/2 border-y border-black/10 py-4 md:py-5 dark:border-[#D5D5D5]/10"
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#C2E6EC] to-transparent md:w-32 dark:from-[hsl(224,48%,9%)]"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#C2E6EC] to-transparent md:w-32 dark:from-[hsl(224,48%,9%)]"
            />
            <div className="flex flex-col gap-3 md:gap-4">
                <MarqueeRow items={rowA} />
                <MarqueeRow items={rowB} reverse />
            </div>
        </div>
    );
}
