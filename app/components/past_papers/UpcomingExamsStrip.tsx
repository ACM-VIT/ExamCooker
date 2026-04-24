import React from "react";
import Link from "next/link";
import { examTypeLabel } from "@/lib/examSlug";
import type { UpcomingExamItem } from "@/lib/data/upcomingExams";

type Props = {
    items: UpcomingExamItem[];
    heading?: string;
    emptyPrompt?: string | null;
};

function formatWhen(date: Date | null): string | null {
    if (!date) return null;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days > 1 && days <= 14) return `In ${days} days`;
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

function CompactExamCard({
    item,
    when,
}: {
    item: UpcomingExamItem;
    when: string | null;
}) {
    return (
        <Link
            href={`/past_papers/${encodeURIComponent(item.courseCode)}`}
            prefetch
            transitionTypes={["nav-forward"]}
            className="flex h-full flex-col gap-2 rounded-md border border-black/10 bg-white p-3 transition-all duration-200 hover:border-black/30 hover:shadow-md dark:border-[#D5D5D5]/10 dark:bg-[#0C1222] dark:hover:border-[#D5D5D5]/35 dark:hover:shadow-[0_4px_18px_rgba(59,244,199,0.08)] sm:p-4"
        >
            <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-black/55 dark:text-[#D5D5D5]/55">
                    {item.courseCode}
                </span>
                {when && (
                    <span className="rounded bg-[#5FC4E7]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1b6f8f] dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]">
                        {when}
                    </span>
                )}
            </div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-black dark:text-[#D5D5D5]">
                {item.courseTitle}
            </h3>
            <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                {item.examType && (
                    <span className="inline-flex items-center rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black/80 dark:bg-white/10 dark:text-[#D5D5D5]/90">
                        {examTypeLabel(item.examType)}
                    </span>
                )}
                {item.slots.map((slot) => (
                    <span
                        key={slot}
                        className="inline-flex items-center rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] font-bold text-black/80 dark:bg-white/10 dark:text-[#D5D5D5]/90"
                    >
                        {slot}
                    </span>
                ))}
            </div>
        </Link>
    );
}

export default function UpcomingExamsStrip({
    items,
    heading = "Upcoming Exams",
    emptyPrompt = "No upcoming exams scheduled yet.",
}: Props) {
    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-black/70 dark:text-[#D5D5D5]/70">
                    {heading}
                </h2>
                {items.length > 0 && (
                    <span className="text-xs text-black/50 dark:text-[#D5D5D5]/50">
                        {items.length}
                    </span>
                )}
            </header>

            {items.length === 0 ? (
                emptyPrompt !== null ? (
                    <div className="rounded-md border border-dashed border-black/15 bg-white/50 px-4 py-5 text-center text-sm text-black/60 dark:border-[#D5D5D5]/15 dark:bg-white/5 dark:text-[#D5D5D5]/60">
                        {emptyPrompt}
                    </div>
                ) : null
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((item) => {
                        const when = formatWhen(item.scheduledAt);
                        return <CompactExamCard key={item.id} item={item} when={when} />;
                    })}
                </div>
            )}
        </section>
    );
}
