import React from "react";
import Link from "next/link";
import type { UpcomingExamItem } from "@/lib/data/upcomingExams";

function MarqueeItem({
    item,
    prefetch,
    variant = "default",
}: {
    item: UpcomingExamItem;
    prefetch: boolean;
    variant?: "default" | "past_papers";
}) {
    return (
        <Link
            href={`/past_papers/${encodeURIComponent(item.courseCode)}`}
            prefetch={prefetch}
            transitionTypes={["nav-forward"]}
            className={`group inline-flex items-center gap-3 whitespace-nowrap text-base transition-colors md:text-lg ${
                variant === "default"
                    ? "text-black/75 hover:text-[#253EE0] md:text-white/85 md:hover:text-[#3BF4C7] dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7] dark:md:text-white/85"
                    : "text-black/75 hover:text-[#253EE0] dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
            }`}
        >
            <span
                className={`font-mono text-xs font-semibold uppercase tracking-[0.16em] group-hover:text-current md:text-sm ${
                    variant === "default"
                        ? "text-black/55 md:text-white/65 dark:text-[#D5D5D5]/55 dark:md:text-white/65"
                        : "text-black/55 dark:text-[#D5D5D5]/55"
                }`}
            >
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
    variant,
}: {
    items: UpcomingExamItem[];
    prefetch?: boolean;
    reverse?: boolean;
    variant: "default" | "past_papers";
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
                        <MarqueeItem item={item} prefetch={prefetch === true && copy === "base"} variant={variant} />
                        <span
                            aria-hidden="true"
                            className={`select-none text-xs ${
                                variant === "default"
                                    ? "text-black/25 md:text-white/30 dark:text-[#D5D5D5]/20 dark:md:text-white/30"
                                    : "text-black/25 dark:text-[#D5D5D5]/20"
                            }`}
                        >
                            ◆
                        </span>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

export default async function ExamsMarquee({
    items,
    variant = "default",
}: {
    items: UpcomingExamItem[];
    variant?: "default" | "past_papers";
}) {
    if (items.length === 0) return null;

    const mid = Math.ceil(items.length / 2);
    const rowA = items;
    const rowB = items.length > 3 ? [...items.slice(mid), ...items.slice(0, mid)] : items;

    return (
        <div
            role="region"
            aria-label="Upcoming exams"
            className={`relative left-1/2 w-screen -translate-x-1/2 border-y py-4 md:py-5 ${
                variant === "default"
                    ? "border-black/10 md:border-white/15 dark:border-[#D5D5D5]/10 dark:md:border-white/15"
                    : "border-black/10 dark:border-[#D5D5D5]/10"
            }`}
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
                <MarqueeRow items={rowA} prefetch variant={variant} />
                <MarqueeRow items={rowB} reverse variant={variant} />
            </div>
        </div>
    );
}
