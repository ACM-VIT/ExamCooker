"use client";

import { addTransitionType, memo, startTransition, useCallback, useEffect, useMemo, useState } from "react";
import debounce from "lodash/debounce";
import Image from "@/app/components/common/AppImage";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type ResourceFiltersProps = {
    initialSearch: string;
    initialYear: string;
    years: string[];
};

function ResourceFilters({
    initialSearch,
    initialYear,
    years,
}: ResourceFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [query, setQuery] = useState("");

    useEffect(() => {
        setQuery((currentQuery) => currentQuery === initialSearch ? currentQuery : initialSearch);
    }, [initialSearch]);

    const updateUrl = useMemo(
        () =>
            debounce((nextQuery: string, nextYear: string) => {
                const params = new URLSearchParams(window.location.search);
                const trimmedQuery = nextQuery.trim();

                if (trimmedQuery) {
                    params.set("search", trimmedQuery);
                } else {
                    params.delete("search");
                }

                if (nextYear) {
                    params.set("year", nextYear);
                } else {
                    params.delete("year");
                }

                const queryString = params.toString();
                startTransition(() => {
                    addTransitionType("filter-results");
                    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
                        scroll: false,
                    });
                });
            }, 200),
        [pathname, router],
    );

    useEffect(
        () => () => {
            updateUrl.cancel();
        },
        [updateUrl],
    );

    const handleQueryChange = useCallback((value: string) => {
        setQuery(value);
        updateUrl(value, initialYear);
    }, [initialYear, updateUrl]);

    const handleYearSelect = useCallback((value: string) => {
        updateUrl.cancel();
        updateUrl(query, value === initialYear ? "" : value);
    }, [initialYear, query, updateUrl]);

    const clearFilters = useCallback(() => {
        updateUrl.cancel();
        setQuery("");
        startTransition(() => {
            addTransitionType("filter-results");
            router.replace(pathname, { scroll: false });
        });
    }, [pathname, router, updateUrl]);

    const hasFilters = Boolean(query.trim() || initialYear);
    const activeYearClass =
        "border-black bg-[#82BEE9] text-black dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]";
    const inactiveYearClass =
        "border-[#5FC4E7] bg-[#5FC4E7]/20 text-black hover:bg-[#5FC4E7]/40 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/5 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/10";

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-stretch gap-2 sm:gap-3">
                <div className="relative flex h-12 min-w-0 flex-1 items-center border border-black/25 bg-white px-2 dark:border-[#D5D5D5]/30 dark:bg-[#3D414E]">
                    <Image src={SearchIcon} alt="search" className="dark:invert-[.835]" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => handleQueryChange(event.target.value)}
                        placeholder="Search courses, modules, or topics..."
                        className="h-full min-w-0 flex-1 bg-transparent px-4 py-0 text-sm text-black placeholder:text-black/50 focus:outline-none sm:text-base dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/60"
                    />
                    {query && (
                        <button
                            onClick={() => handleQueryChange("")}
                            type="button"
                            aria-label="Clear search"
                            className="inline-flex h-7 w-7 items-center justify-center text-black/60 transition-colors hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                        >
                            <svg
                                viewBox="0 0 14 14"
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            >
                                <path d="M1 1L13 13M13 1L1 13" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => handleYearSelect("")}
                    className={`inline-flex h-9 items-center border-2 px-3 text-sm font-semibold transition ${
                        !initialYear ? activeYearClass : inactiveYearClass
                    }`}
                >
                    All years
                </button>
                {years.map((year) => (
                    <button
                        key={year}
                        type="button"
                        onClick={() => handleYearSelect(year)}
                        className={`inline-flex h-9 items-center border-2 px-3 text-sm font-semibold transition ${
                            initialYear === year ? activeYearClass : inactiveYearClass
                        }`}
                    >
                        {year}
                    </button>
                ))}
                {hasFilters ? (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex h-9 items-center gap-1.5 px-2 text-sm font-medium text-black/60 transition hover:text-black dark:text-[#D5D5D5]/55 dark:hover:text-[#D5D5D5]"
                    >
                        <X className="h-3.5 w-3.5" />
                        Reset
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export default memo(ResourceFilters);
