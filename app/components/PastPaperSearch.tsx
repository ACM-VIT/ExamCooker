"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "@/app/components/common/AppImage";
import SearchIcon from "@/app/components/assets/seacrh.svg";

type Suggestion = {
    id: string;
    title: string;
    courseCode: string;
    metadata: string;
    paperCount: number;
};

export default function PastPaperSearch({
    initialQuery = "",
    initialDisplay = "",
}: {
    initialQuery?: string;
    initialDisplay?: string;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(initialDisplay || initialQuery || searchParams.get("search") || "");
    const [isOpen, setIsOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setQuery(searchParams.get("label") || searchParams.get("search") || "");
        setIsOpen(false);
        setHighlightedIndex(-1);
    }, [searchParams]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchSuggestions = useCallback(async (value: string, signal?: AbortSignal) => {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }

        const res = await fetch(`/api/past-papers/search?q=${encodeURIComponent(trimmed)}`, {
            signal,
        });
        if (!res.ok) {
            return [];
        }

        const data: { items: Suggestion[] } = await res.json();
        return data.items;
    }, []);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            setSuggestions([]);
            setIsOpen(false);
            setHighlightedIndex(-1);
            return;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(async () => {
            try {
                const items = await fetchSuggestions(trimmed, controller.signal);
                setSuggestions(items);
                if (isFocused) {
                    setIsOpen(items.length > 0);
                }
            } catch (error) {
                if ((error as { name?: string })?.name === "AbortError") return;
                setSuggestions([]);
            }
        }, 150);

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [fetchSuggestions, isFocused, query]);

    const applySearch = (searchValue: string, labelValue?: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("page");

        if (searchValue.trim()) {
            params.set("search", searchValue.trim());
        } else {
            params.delete("search");
        }

        if (labelValue?.trim()) {
            params.set("label", labelValue.trim());
        } else {
            params.delete("label");
        }

        router.push(`/past_papers?${params.toString()}`);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        setHighlightedIndex(-1);
        setIsOpen(value.trim().length > 0);
        if (!value.trim()) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("search");
            params.delete("label");
            params.delete("page");
            router.push(`/past_papers?${params.toString()}`);
        }
    };

    const handleSelectSuggestion = (suggestion: Suggestion) => {
        setQuery(suggestion.title);
        setIsOpen(false);
        setHighlightedIndex(-1);
        setSuggestions([]);
        applySearch(suggestion.courseCode, suggestion.title);
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            setIsOpen(false);
            return;
        }

        if (e.key === "ArrowDown" && isOpen && suggestions.length > 0) {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === "ArrowUp" && isOpen && suggestions.length > 0) {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();

            if (isOpen && suggestions.length > 0) {
                const selected = highlightedIndex >= 0 ? suggestions[highlightedIndex] : suggestions[0];
                handleSelectSuggestion(selected);
                return;
            }

            const items = await fetchSuggestions(query);
            if (items.length > 0) {
                handleSelectSuggestion(items[0]);
                return;
            }
            setIsOpen(false);
        }
    };

    const clearSelection = () => {
        setQuery("");
        setSuggestions([]);
        setIsOpen(false);
        setHighlightedIndex(-1);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("search");
        params.delete("label");
        params.delete("page");
        router.push(`/past_papers?${params.toString()}`);
        inputRef.current?.focus();
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="relative">
                <div className="relative flex items-center bg-white dark:bg-[#1e2330] border-2 border-[#82BEE9] dark:border-[#D5D5D5] w-full px-4 py-1 shadow-[3px_3px_0_0_rgba(130,190,233,0.5)] dark:shadow-[3px_3px_0_0_rgba(213,213,213,0.3)] rounded-lg">
                    <Image src={SearchIcon} alt="search" className="dark:invert-[.835] w-5 h-5" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="px-4 py-3 w-full focus:outline-none bg-transparent text-lg placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        placeholder="Search past papers by title, code, or tag..."
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            setIsFocused(true);
                            if (query.trim() && suggestions.length > 0) {
                                setIsOpen(true);
                            }
                        }}
                        onBlur={() => setIsFocused(false)}
                    />
                    {query && (
                        <button
                            onClick={clearSelection}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                            type="button"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>

                {isOpen && suggestions.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-[#1a1f2e] border-2 border-black dark:border-[#D5D5D5] shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.3)] max-h-80 overflow-y-auto"
                    >
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={suggestion.id}
                                onClick={() => handleSelectSuggestion(suggestion)}
                                className={`w-full px-4 py-3 text-left flex justify-between items-center hover:bg-[#5FC4E7]/30 dark:hover:bg-[#3BF4C7]/20 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
                                    highlightedIndex === index ? "bg-[#5FC4E7]/30 dark:bg-[#3BF4C7]/20" : ""
                                }`}
                            >
                                <div className="min-w-0 pr-4">
                                    <div className="font-semibold truncate">{suggestion.title}</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{suggestion.metadata}</div>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2 shrink-0">
                                    <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                                        {suggestion.paperCount} papers
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {isOpen && query.trim() && suggestions.length === 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-[#1a1f2e] border-2 border-black dark:border-[#D5D5D5] shadow-[3px_3px_0_0_rgba(0,0,0,1)] px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                        No past papers found for &quot;{query}&quot;
                    </div>
                )}
            </div>
        </div>
    );
}
