"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { searchPastPaperLinkTargets } from "@/app/actions/search-past-paper-link-targets";
import {
    formatPaperLinkOption,
    type PaperLinkOption,
} from "./paper-link-types";

type Props = {
    value: PaperLinkOption | null;
    excludePaperId: string;
    courseId: string | null;
    onChange: (paper: PaperLinkOption | null) => void;
    placeholder?: string;
};

export default function PaperPicker({
    value,
    excludePaperId,
    courseId,
    onChange,
    placeholder,
}: Props) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [results, setResults] = useState<PaperLinkOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const trimmedQuery = query.trim();
    const shouldShowResults = open && !value;
    const statusMessage = useMemo(() => {
        if (!trimmedQuery) {
            return "Search by paper title, ID, or paste a paper URL.";
        }
        if (loading) {
            return "Searching papers…";
        }
        if (error) {
            return error;
        }
        return "No matching papers found.";
    }, [error, loading, trimmedQuery]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        setHighlight(0);
    }, [query]);

    useEffect(() => {
        if (!shouldShowResults) {
            return;
        }

        if (!trimmedQuery) {
            setResults([]);
            setLoading(false);
            setError(null);
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const matches = await searchPastPaperLinkTargets({
                    query: trimmedQuery,
                    excludePaperId,
                    courseId,
                });
                if (!cancelled) {
                    setResults(matches);
                }
            } catch (searchError) {
                if (!cancelled) {
                    setResults([]);
                    setError(
                        searchError instanceof Error
                            ? searchError.message
                            : "Search failed",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }, 200);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [courseId, excludePaperId, shouldShowResults, trimmedQuery]);

    const choose = (paper: PaperLinkOption) => {
        onChange(paper);
        setQuery("");
        setResults([]);
        setError(null);
        setOpen(false);
    };

    const clear = () => {
        onChange(null);
        setQuery("");
        setResults([]);
        setError(null);
    };

    return (
        <div ref={containerRef} className="relative w-full">
            {value ? (
                <div className="flex items-center gap-2 border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-black dark:text-[#D5D5D5]">
                            {value.title}
                        </p>
                        <p className="truncate font-mono text-xs text-black/60 dark:text-[#D5D5D5]/60">
                            {formatPaperLinkOption(value) || value.id}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={clear}
                        className="shrink-0 text-xs text-black/60 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:text-[#3BF4C7]"
                    >
                        change
                    </button>
                </div>
            ) : (
                <input
                    type="text"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(event) => {
                        if (!shouldShowResults) return;
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setHighlight((current) =>
                                Math.min(current + 1, Math.max(results.length - 1, 0)),
                            );
                        } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setHighlight((current) => Math.max(current - 1, 0));
                        } else if (event.key === "Enter") {
                            event.preventDefault();
                            if (results[highlight]) choose(results[highlight]);
                        } else if (event.key === "Escape") {
                            setOpen(false);
                        }
                    }}
                    placeholder={
                        placeholder ?? "Search by paper title, ID, or paste a paper URL"
                    }
                    className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm text-black dark:text-[#D5D5D5] placeholder-black/40 dark:placeholder-[#D5D5D5]/30 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                />
            )}

            {shouldShowResults && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] shadow-lg">
                    {results.length > 0 ? (
                        <ul>
                            {results.map((paper, index) => (
                                <li
                                    key={paper.id}
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        choose(paper);
                                    }}
                                    onMouseEnter={() => setHighlight(index)}
                                    className={`cursor-pointer px-3 py-2 ${
                                        index === highlight
                                            ? "bg-[#5FC4E7]/40 dark:bg-[#3BF4C7]/10"
                                            : ""
                                    }`}
                                >
                                    <p className="truncate text-sm font-semibold text-black dark:text-[#D5D5D5]">
                                        {paper.title}
                                    </p>
                                    <p className="truncate text-xs text-black/60 dark:text-[#D5D5D5]/60">
                                        {formatPaperLinkOption(paper) || paper.id}
                                    </p>
                                    <p className="truncate font-mono text-[11px] text-black/45 dark:text-[#D5D5D5]/45">
                                        {paper.id}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="px-3 py-2 text-xs text-black/60 dark:text-[#D5D5D5]/60">
                            {statusMessage}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
