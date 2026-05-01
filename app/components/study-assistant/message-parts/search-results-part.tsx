"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "@/app/components/common/AppImage";
import { ArrowUpRight, BookOpen, FileText } from "lucide-react";
import { ToolShell, type ToolState } from "./tool-shell";
import { ToolLoading } from "./tool-loading";

export interface SearchResultItem {
    id: string;
    title: string;
    href: string;
    thumbnail?: string | null;
    type?: "note" | "past_paper";
}

export interface SearchResultsOutput {
    query?: string | null;
    filters?: {
        courseCode?: string | null;
        examType?: string | null;
        slot?: string | null;
        year?: string | null;
    };
    items: SearchResultItem[];
    total?: number;
}

interface SearchResultsPartProps {
    toolName: string;
    state: ToolState;
    output?: SearchResultsOutput | unknown;
    errorText?: string;
    isGlobalStreaming?: boolean;
}

export const SearchResultsPart = memo(function SearchResultsPart({
    toolName,
    state,
    output,
    errorText,
    isGlobalStreaming,
}: SearchResultsPartProps) {
    const isPapers = toolName === "search_past_papers";
    const defaultLabel = isPapers ? "past papers" : "notes";

    if (state === "input-streaming" || state === "input-available") {
        return (
            <ToolLoading
                label={`Searching ${defaultLabel}`}
                active={Boolean(isGlobalStreaming)}
            />
        );
    }

    const payload = (output as SearchResultsOutput | null) ?? null;
    const items = payload?.items ?? [];

    const filterChips = [
        payload?.filters?.courseCode,
        payload?.filters?.examType,
        payload?.filters?.slot,
        payload?.filters?.year,
    ].filter(Boolean) as string[];

    const subtitle = filterChips.length
        ? filterChips.join(" · ")
        : payload?.query
            ? `"${payload.query}"`
            : undefined;

    return (
        <ToolShell
            toolName={toolName}
            label={isPapers ? "Past papers" : "Notes"}
            state={state}
            errorText={errorText}
            headerExtra={[
                items.length ? `${items.length} result${items.length === 1 ? "" : "s"}` : "no results",
                subtitle,
            ].filter(Boolean).join(" · ")}
        >
            {items.length ? (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {items.map((item) => (
                        <Link
                            key={item.id}
                            href={item.href}
                            target="_blank"
                            className="group flex items-start gap-3 overflow-hidden rounded-xl border border-black/10 bg-white p-2.5 transition-colors hover:border-black/20 hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
                        >
                            {item.thumbnail ? (
                                <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-black/5 dark:bg-white/10">
                                    <Image
                                        src={item.thumbnail}
                                        alt=""
                                        fill
                                        sizes="36px"
                                        className="object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md bg-black/5 dark:bg-white/10">
                                    {isPapers ? (
                                        <FileText className="h-4 w-4 text-black/45 dark:text-[#D5D5D5]/45" strokeWidth={1.75} />
                                    ) : (
                                        <BookOpen className="h-4 w-4 text-black/45 dark:text-[#D5D5D5]/45" strokeWidth={1.75} />
                                    )}
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-[13px] font-medium leading-snug text-black group-hover:underline dark:text-[#D5D5D5]">
                                    {item.title}
                                </p>
                            </div>
                            <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-black/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-[#D5D5D5]/35" />
                        </Link>
                    ))}
                </div>
            ) : (
                <p className="text-[13px] text-black/55 dark:text-[#D5D5D5]/55">
                    No matches. Try a different course code or a broader query.
                </p>
            )}
        </ToolShell>
    );
});
