"use client";

import { memo } from "react";
import Link from "next/link";
import { FileText, BookOpen, ArrowUpRight, ScrollText } from "lucide-react";
import { ToolShell, type ToolState } from "./tool-shell";
import { ToolLoading } from "./tool-loading";

interface ExamCount {
    slug: string;
    label: string;
    count: number;
}

interface CourseOverviewOutput {
    course: {
        code: string;
        title: string;
        href: string;
    };
    examCounts: ExamCount[];
    syllabus: { id: string; name: string; href: string } | null;
    recentNotes: { id: string; title: string; href: string }[];
    recentPapers: { id: string; title: string; href: string }[];
    error?: string;
}

interface CourseOverviewPartProps {
    state: ToolState;
    output?: CourseOverviewOutput | unknown;
    errorText?: string;
    isGlobalStreaming?: boolean;
}

export const CourseOverviewPart = memo(function CourseOverviewPart({
    state,
    output,
    errorText,
    isGlobalStreaming,
}: CourseOverviewPartProps) {
    if (state === "input-streaming" || state === "input-available") {
        return <ToolLoading label="Pulling course info" active={Boolean(isGlobalStreaming)} />;
    }

    const data = (output as CourseOverviewOutput | null) ?? null;

    if (data?.error) {
        return (
            <ToolShell
                toolName="get_course_overview"
                label="Course overview"
                state="output-error"
                errorText={data.error}
            />
        );
    }

    if (!data) return null;

    return (
        <ToolShell
            toolName="get_course_overview"
            label={`${data.course.title} · ${data.course.code}`}
            state={state}
            errorText={errorText}
            headerExtra="Course overview"
        >
            <div className="space-y-4">
                {/* Exam counts row */}
                {data.examCounts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {data.examCounts.map((e) => (
                            <span
                                key={e.slug}
                                className="inline-flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-black/75 dark:border-white/10 dark:bg-white/10 dark:text-[#D5D5D5]/80"
                            >
                                <FileText className="h-3 w-3 text-black/50 dark:text-[#D5D5D5]/50" strokeWidth={1.75} />
                                <span>{e.label}</span>
                                <span className="font-mono text-black/50 dark:text-[#D5D5D5]/50">· {e.count}</span>
                            </span>
                        ))}
                    </div>
                )}

                {/* Syllabus */}
                {data.syllabus && (
                    <Link
                        href={data.syllabus.href}
                        target="_blank"
                        className="group flex items-center gap-2.5 rounded-xl border border-black/10 bg-white p-3 transition-colors hover:border-black/20 hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
                    >
                        <ScrollText className="h-4 w-4 shrink-0 text-black/55 dark:text-[#D5D5D5]/55" strokeWidth={1.75} />
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-black/50 dark:text-[#D5D5D5]/50">
                                Syllabus
                            </p>
                            <p className="truncate text-[13px] font-medium text-black group-hover:underline dark:text-[#D5D5D5]">
                                {data.syllabus.name}
                            </p>
                        </div>
                        <ArrowUpRight className="h-3 w-3 shrink-0 text-black/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-[#D5D5D5]/35" />
                    </Link>
                )}

                {/* Recent papers */}
                {data.recentPapers.length > 0 && (
                    <div>
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-black/50 dark:text-[#D5D5D5]/50">
                            Recent papers
                        </p>
                        <ul className="space-y-1">
                            {data.recentPapers.map((p) => (
                                <li key={p.id}>
                                    <Link
                                        href={p.href}
                                        target="_blank"
                                        className="group flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                                    >
                                        <FileText className="h-3.5 w-3.5 shrink-0 text-black/45 dark:text-[#D5D5D5]/45" strokeWidth={1.75} />
                                        <span className="flex-1 truncate text-black group-hover:underline dark:text-[#D5D5D5]">
                                            {p.title}
                                        </span>
                                        <ArrowUpRight className="h-3 w-3 shrink-0 text-black/35 dark:text-[#D5D5D5]/35" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Recent notes */}
                {data.recentNotes.length > 0 && (
                    <div>
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-black/50 dark:text-[#D5D5D5]/50">
                            Recent notes
                        </p>
                        <ul className="space-y-1">
                            {data.recentNotes.map((n) => (
                                <li key={n.id}>
                                    <Link
                                        href={n.href}
                                        target="_blank"
                                        className="group flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                                    >
                                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-black/45 dark:text-[#D5D5D5]/45" strokeWidth={1.75} />
                                        <span className="flex-1 truncate text-black group-hover:underline dark:text-[#D5D5D5]">
                                            {n.title}
                                        </span>
                                        <ArrowUpRight className="h-3 w-3 shrink-0 text-black/35 dark:text-[#D5D5D5]/35" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="pt-1">
                    <Link
                        href={data.course.href}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-black/65 hover:text-black dark:text-[#D5D5D5]/65 dark:hover:text-[#D5D5D5]"
                    >
                        Open the full course page
                        <ArrowUpRight className="h-3 w-3" />
                    </Link>
                </div>
            </div>
        </ToolShell>
    );
});
