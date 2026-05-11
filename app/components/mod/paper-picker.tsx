"use client";

import React, { Activity, useEffect, useMemo, useReducer, useRef } from "react";
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

type PaperPickerState = {
    error: string | null;
    highlight: number;
    loading: boolean;
    open: boolean;
    query: string;
    results: PaperLinkOption[];
};

type PaperPickerAction =
    | { type: "close" }
    | { type: "open" }
    | { type: "query"; value: string }
    | { type: "highlight"; value: number }
    | { type: "highlight-next"; maxIndex: number }
    | { type: "highlight-previous" }
    | { type: "empty-query" }
    | { type: "search-start" }
    | { type: "search-success"; results: PaperLinkOption[] }
    | { type: "search-error"; message: string }
    | { type: "reset"; close?: boolean };

const initialPaperPickerState: PaperPickerState = {
    error: null,
    highlight: 0,
    loading: false,
    open: false,
    query: "",
    results: [],
};

function paperPickerReducer(
    state: PaperPickerState,
    action: PaperPickerAction,
): PaperPickerState {
    switch (action.type) {
        case "close":
            return { ...state, open: false };
        case "open":
            return { ...state, open: true };
        case "query":
            return {
                ...state,
                highlight: 0,
                open: true,
                query: action.value,
            };
        case "highlight":
            return { ...state, highlight: action.value };
        case "highlight-next":
            return {
                ...state,
                highlight: Math.min(state.highlight + 1, Math.max(action.maxIndex, 0)),
            };
        case "highlight-previous":
            return { ...state, highlight: Math.max(state.highlight - 1, 0) };
        case "empty-query":
            return { ...state, error: null, loading: false, results: [] };
        case "search-start":
            return { ...state, error: null, loading: true };
        case "search-success":
            return { ...state, loading: false, results: action.results };
        case "search-error":
            return {
                ...state,
                error: action.message,
                loading: false,
                results: [],
            };
        case "reset":
            return {
                ...state,
                error: null,
                highlight: 0,
                open: action.close ? false : state.open,
                query: "",
                results: [],
            };
    }
}

export default function PaperPicker({
    value,
    excludePaperId,
    courseId,
    onChange,
    placeholder,
}: Props) {
    const [{ error, highlight, loading, open, query, results }, dispatch] =
        useReducer(paperPickerReducer, initialPaperPickerState);
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
                dispatch({ type: "close" });
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!shouldShowResults) {
            return;
        }

        if (!trimmedQuery) {
            dispatch({ type: "empty-query" });
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            dispatch({ type: "search-start" });
            try {
                const matches = await searchPastPaperLinkTargets({
                    query: trimmedQuery,
                    excludePaperId,
                    courseId,
                });
                if (!cancelled) {
                    dispatch({ type: "search-success", results: matches });
                }
            } catch (searchError) {
                if (!cancelled) {
                    dispatch({
                        type: "search-error",
                        message:
                            searchError instanceof Error
                                ? searchError.message
                                : "Search failed",
                    });
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
        dispatch({ type: "reset", close: true });
    };

    const clear = () => {
        onChange(null);
        dispatch({ type: "reset" });
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
                        dispatch({ type: "query", value: event.target.value });
                    }}
                    onFocus={() => dispatch({ type: "open" })}
                    onKeyDown={(event) => {
                        if (!shouldShowResults) return;
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            dispatch({
                                type: "highlight-next",
                                maxIndex: results.length - 1,
                            });
                        } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            dispatch({ type: "highlight-previous" });
                        } else if (event.key === "Enter") {
                            event.preventDefault();
                            if (results[highlight]) choose(results[highlight]);
                        } else if (event.key === "Escape") {
                            dispatch({ type: "close" });
                        }
                    }}
                    placeholder={
                        placeholder ?? "Search by paper title, ID, or paste a paper URL"
                    }
                    className="w-full border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-sm text-black dark:text-[#D5D5D5] placeholder-black/40 dark:placeholder-[#D5D5D5]/30 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                />
            )}

            <Activity mode={shouldShowResults ? "visible" : "hidden"}>
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
                                    onMouseEnter={() =>
                                        dispatch({ type: "highlight", value: index })
                                    }
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
            </Activity>
        </div>
    );
}
