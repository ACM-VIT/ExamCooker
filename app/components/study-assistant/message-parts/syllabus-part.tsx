"use client";

import { memo } from "react";
import Link from "next/link";
import { ArrowUpRight, ScrollText } from "lucide-react";
import { ToolShell, type ToolState } from "./tool-shell";
import { ToolLoading } from "./tool-loading";

interface SyllabusRef {
    id: string;
    name: string;
    href: string;
}

interface SyllabusOutputExact {
    match: "exact";
    syllabus: SyllabusRef;
}

interface SyllabusOutputSearch {
    match: "search";
    items: SyllabusRef[];
}

type SyllabusOutput = SyllabusOutputExact | SyllabusOutputSearch;

interface SyllabusPartProps {
    state: ToolState;
    output?: SyllabusOutput | unknown;
    errorText?: string;
    isGlobalStreaming?: boolean;
}

export const SyllabusPart = memo(function SyllabusPart({
    state,
    output,
    errorText,
    isGlobalStreaming,
}: SyllabusPartProps) {
    if (state === "input-streaming" || state === "input-available") {
        return <ToolLoading label="Finding the syllabus" active={Boolean(isGlobalStreaming)} />;
    }

    const data = (output as SyllabusOutput | null) ?? null;

    const items: SyllabusRef[] =
        data?.match === "exact" && data.syllabus
            ? [data.syllabus]
            : data?.match === "search"
                ? data.items
                : [];

    return (
        <ToolShell
            toolName="get_syllabus"
            label="Syllabus"
            state={state}
            errorText={errorText}
            headerExtra={items.length ? `${items.length} match${items.length === 1 ? "" : "es"}` : "no match"}
        >
            {items.length ? (
                <ul className="space-y-1.5">
                    {items.map((s) => (
                        <li key={s.id}>
                            <Link
                                href={s.href}
                                target="_blank"
                                className="group flex items-center gap-2.5 rounded-xl border border-black/10 bg-white p-3 transition-colors hover:border-black/20 hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
                            >
                                <ScrollText className="h-4 w-4 shrink-0 text-black/55 dark:text-[#D5D5D5]/55" strokeWidth={1.75} />
                                <p className="flex-1 truncate text-[13px] font-medium text-black group-hover:underline dark:text-[#D5D5D5]">
                                    {s.name}
                                </p>
                                <ArrowUpRight className="h-3 w-3 shrink-0 text-black/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-[#D5D5D5]/35" />
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-[13px] text-black/55 dark:text-[#D5D5D5]/55">
                    No syllabus found. Try asking with a different course code.
                </p>
            )}
        </ToolShell>
    );
});
