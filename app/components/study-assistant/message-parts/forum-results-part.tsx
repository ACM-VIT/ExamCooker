"use client";

import { memo } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowUp, ArrowDown, MessageCircle } from "lucide-react";
import { ToolShell, type ToolState } from "./tool-shell";
import { ToolLoading } from "./tool-loading";

export interface ForumPostItem {
    id: string;
    title: string;
    href: string;
    snippet: string;
    author: string;
    upvotes: number;
    downvotes: number;
    commentCount: number;
    createdAt: string;
}

export interface ForumResultsOutput {
    query?: string;
    items: ForumPostItem[];
    total?: number;
}

interface ForumResultsPartProps {
    state: ToolState;
    output?: ForumResultsOutput | unknown;
    errorText?: string;
    isGlobalStreaming?: boolean;
}

function formatRelative(iso: string) {
    try {
        const diff = Date.now() - new Date(iso).getTime();
        const days = Math.floor(diff / 86_400_000);
        if (days < 1) return "today";
        if (days < 2) return "yesterday";
        if (days < 7) return `${days}d ago`;
        if (days < 30) return `${Math.floor(days / 7)}w ago`;
        if (days < 365) return `${Math.floor(days / 30)}mo ago`;
        return `${Math.floor(days / 365)}y ago`;
    } catch {
        return "";
    }
}

export const ForumResultsPart = memo(function ForumResultsPart({
    state,
    output,
    errorText,
    isGlobalStreaming,
}: ForumResultsPartProps) {
    if (state === "input-streaming" || state === "input-available") {
        return <ToolLoading label="Searching the forum" active={Boolean(isGlobalStreaming)} />;
    }

    const payload = (output as ForumResultsOutput | null) ?? null;
    const items = payload?.items ?? [];

    return (
        <ToolShell
            toolName="search_forum"
            label="Forum discussions"
            state={state}
            errorText={errorText}
            headerExtra={
                items.length
                    ? `${items.length} thread${items.length === 1 ? "" : "s"}${payload?.query ? ` · "${payload.query}"` : ""}`
                    : "no threads"
            }
        >
            {items.length ? (
                <ul className="space-y-1.5">
                    {items.map((item) => (
                        <li key={item.id}>
                            <Link
                                href={item.href}
                                target="_blank"
                                className="group block rounded-xl border border-black/10 bg-white p-3 transition-colors hover:border-black/20 hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
                            >
                                <div className="flex items-start gap-2">
                                    <p className="flex-1 text-[13px] font-medium leading-snug text-black group-hover:underline dark:text-[#D5D5D5]">
                                        {item.title}
                                    </p>
                                    <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-black/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-[#D5D5D5]/35" />
                                </div>
                                {item.snippet && (
                                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-black/60 dark:text-[#D5D5D5]/60">
                                        {item.snippet}
                                    </p>
                                )}
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-black/50 dark:text-[#D5D5D5]/50">
                                    <span>{item.author}</span>
                                    <span>·</span>
                                    <span>{formatRelative(item.createdAt)}</span>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-0.5">
                                        <ArrowUp className="h-3 w-3" /> {item.upvotes}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5">
                                        <ArrowDown className="h-3 w-3" /> {item.downvotes}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5">
                                        <MessageCircle className="h-3 w-3" /> {item.commentCount}
                                    </span>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-[13px] text-black/55 dark:text-[#D5D5D5]/55">
                    No forum threads matched. Try a different query.
                </p>
            )}
        </ToolShell>
    );
});
