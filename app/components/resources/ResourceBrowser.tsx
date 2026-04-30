"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import debounce from "lodash/debounce";
import { ArrowUpRight, X } from "lucide-react";
import { usePathname } from "next/navigation";
import Image from "@/app/components/common/AppImage";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import ResourceCourseCard from "@/app/components/resources/ResourceCourseCard";
import { captureResourceSourceOpened } from "@/lib/posthog/client";
import type { VinCourse } from "@/lib/data/vinTogether";

type ResourceBrowserCourse = Pick<
    VinCourse,
    "id" | "slug" | "displayName" | "shortName" | "year" | "image" | "counts" | "matchKeys"
>;

type ResourceBrowserProps = {
    courses: ResourceBrowserCourse[];
    initialSearch: string;
    initialYear: string;
    years: string[];
    sourceUrl: string;
};

function normalizeKey(value: string) {
    return value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\b(the|and|of|to|for|in)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function replaceResourceUrl(pathname: string, nextQuery: string, nextYear: string) {
    if (typeof window === "undefined") return;

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
    const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
}

function SourceButton({
    pathname,
    sourceUrl,
}: {
    pathname: string;
    sourceUrl: string;
}) {
    return (
        <div className="group relative inline-flex h-12 shrink-0 items-stretch">
            <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]" />
            <div className="absolute inset-0 blur-[60px] bg-[#82BEE9] opacity-0 transition duration-200 group-hover:opacity-25 dark:hidden" />
            <div className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
            <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                    captureResourceSourceOpened({
                        pathname,
                        sourceUrl,
                    })
                }
                className="relative inline-flex h-full items-center gap-1.5 border-2 border-black bg-[#82BEE9] px-4 text-sm font-bold text-black transition duration-150 group-hover:-translate-x-1 group-hover:-translate-y-1 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7]"
            >
                Source
                <ArrowUpRight className="h-4 w-4" />
            </a>
        </div>
    );
}

function ResourceBrowser({
    courses,
    initialSearch,
    initialYear,
    years,
    sourceUrl,
}: ResourceBrowserProps) {
    const pathname = usePathname();
    const [query, setQuery] = useState(initialSearch);
    const [year, setYear] = useState(initialYear);
    const deferredQuery = useDeferredValue(query);

    const searchableCourses = useMemo(
        () =>
            courses.map((course) => ({
                course,
                normalizedMatchKeys: course.matchKeys.map((value) =>
                    normalizeKey(value),
                ),
            })),
        [courses],
    );

    const updateAddressBar = useMemo(
        () =>
            debounce((nextQuery: string, nextYear: string) => {
                replaceResourceUrl(pathname, nextQuery, nextYear);
            }, 200),
        [pathname],
    );

    useEffect(
        () => () => {
            updateAddressBar.cancel();
        },
        [updateAddressBar],
    );

    useEffect(() => {
        const syncFromLocation = () => {
            const params = new URLSearchParams(window.location.search);
            setQuery(params.get("search") ?? "");
            setYear(params.get("year") ?? "");
        };

        window.addEventListener("popstate", syncFromLocation);
        return () => window.removeEventListener("popstate", syncFromLocation);
    }, []);

    const filteredCourses = useMemo(() => {
        const normalizedSearch = normalizeKey(deferredQuery);
        const normalizedYear = year.trim();

        return searchableCourses.filter(({ course, normalizedMatchKeys }) => {
            if (normalizedYear && course.year !== normalizedYear) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            return normalizedMatchKeys.some((value) =>
                value.includes(normalizedSearch),
            );
        }).map(({ course }) => course);
    }, [deferredQuery, searchableCourses, year]);

    const handleQueryChange = useCallback(
        (value: string) => {
            setQuery(value);
            updateAddressBar(value, year);
        },
        [updateAddressBar, year],
    );

    const handleYearSelect = useCallback(
        (value: string) => {
            const nextYear = value === year ? "" : value;
            setYear(nextYear);
            updateAddressBar.cancel();
            replaceResourceUrl(pathname, query, nextYear);
        },
        [pathname, query, updateAddressBar, year],
    );

    const clearFilters = useCallback(() => {
        updateAddressBar.cancel();
        setQuery("");
        setYear("");
        replaceResourceUrl(pathname, "", "");
    }, [pathname, updateAddressBar]);

    const hasFilters = Boolean(query.trim() || year);
    const activeYearClass =
        "border-black bg-[#82BEE9] text-black dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]";
    const inactiveYearClass =
        "border-[#5FC4E7] bg-[#5FC4E7]/20 text-black hover:bg-[#5FC4E7]/40 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/5 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/10";

    return (
        <>
            <div className="flex w-full items-stretch gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
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
                                {query ? (
                                    <button
                                        onClick={() => handleQueryChange("")}
                                        type="button"
                                        aria-label="Clear search"
                                        className="inline-flex h-7 w-7 items-center justify-center text-black/60 transition-colors hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleYearSelect("")}
                                className={`inline-flex h-9 items-center border-2 px-3 text-sm font-semibold transition ${
                                    !year ? activeYearClass : inactiveYearClass
                                }`}
                            >
                                All years
                            </button>
                            {years.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => handleYearSelect(item)}
                                    className={`inline-flex h-9 items-center border-2 px-3 text-sm font-semibold transition ${
                                        year === item ? activeYearClass : inactiveYearClass
                                    }`}
                                >
                                    {item}
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
                </div>
                <SourceButton pathname={pathname} sourceUrl={sourceUrl} />
            </div>

            {filteredCourses.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <header>
                        <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                            {hasFilters
                                ? `${filteredCourses.length} match${filteredCourses.length === 1 ? "" : "es"}`
                                : "All courses"}
                        </h2>
                    </header>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {filteredCourses.map((course) => (
                            <ResourceCourseCard key={course.id} course={course} />
                        ))}
                    </div>
                </section>
            ) : (
                <div className="border-2 border-dashed border-black/30 p-10 text-center dark:border-[#D5D5D5]/30">
                    <p className="text-sm text-black/70 dark:text-[#D5D5D5]/70">
                        {hasFilters
                            ? "No courses match those filters."
                            : "No courses with resources yet."}
                    </p>
                </div>
            )}
        </>
    );
}

export default memo(ResourceBrowser);
