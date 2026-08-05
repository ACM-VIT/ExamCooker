"use client";

import React, { useCallback, useEffect, useRef, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "@/app/components/common/app-image";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import { useToast } from "@/app/components/ui/use-toast";
import { formatSyllabusDisplayName, getCourseSyllabusPath, parseSyllabusName } from "@/lib/seo";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faDownload, faXmark } from "@fortawesome/free-solid-svg-icons";
import { createCourseFuse } from "@/lib/course-search-fuse";
import {
    captureCourseSearchAbandoned,
    captureCourseSearchNoResults,
    captureCourseSearchSelection,
    initializePostHogClient,
    type CourseSearchInteraction,
} from "@/lib/posthog/client";
import {
    downloadPdfFile,
    downloadPdfZip,
} from "@/lib/downloads/browser-downloads";
import {
    buildSyllabusPdfFileName,
    buildSyllabusZipFileName,
} from "@/lib/downloads/resource-names";

type SyllabusItem = { id: string; name: string; fileUrl: string };

function getSyllabusFileName(syllabus: SyllabusItem) {
    const parsed = parseSyllabusName(syllabus.name);
    const displayName = parsed.courseName || formatSyllabusDisplayName(syllabus.name);
    const code = parsed.courseCode ?? syllabus.name.split("_")[0];

    return buildSyllabusPdfFileName({
        courseCode: code,
        courseTitle: displayName,
    });
}

const SyllabusRow = React.memo(function SyllabusRow({
    syllabus,
    selected,
    onToggleSelect,
    onDownload,
    onPrefetch,
    onSelect,
}: {
    syllabus: SyllabusItem;
    selected: boolean;
    onToggleSelect: (id: string) => void;
    onDownload: (id: string) => void;
    onPrefetch: (href: string) => void;
    onSelect: (id: string) => void;
}) {
    const parsed = parseSyllabusName(syllabus.name);
    const displayName = parsed.courseName || formatSyllabusDisplayName(syllabus.name);
    const code = parsed.courseCode ?? syllabus.name.split("_")[0];
    const href = parsed.courseCode
        ? getCourseSyllabusPath(parsed.courseCode)
        : `/syllabus/${syllabus.id}`;

    const handlePrefetch = () => onPrefetch(href);

    const handleSelect = () => onSelect(syllabus.id);

    const handleToggleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onToggleSelect(syllabus.id);
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onDownload(syllabus.id);
    };

    return (
        <Link
            href={href}
            prefetch={false}
            transitionTypes={["nav-forward"]}
            onPointerEnter={handlePrefetch}
            onFocus={handlePrefetch}
            onClick={handleSelect}
            className={`ec-press group flex min-w-0 items-center gap-3 border-2 px-3 py-2.5 transition-[background-color,border-color,transform] duration-200 hover:border-b-white hover:bg-[#5FC4E7]/10 dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10 ${selected
                    ? "border-black bg-[#5FC4E7] dark:border-[#3BF4C7] dark:bg-[#0C1222]"
                    : "border-[#5FC4E7] bg-white dark:border-[#ffffff]/20 dark:bg-[#0C1222]"
                }`}
        >
            <button
                type="button"
                onClick={handleToggleSelect}
                aria-label={selected ? "Deselect syllabus" : "Select syllabus"}
                aria-pressed={selected}
                className={`ec-icon-button inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${selected
                        ? "bg-[#0A0F1C] text-white dark:bg-[#3BF4C7] dark:text-[#0C1222]"
                        : "bg-black/5 text-transparent hover:bg-black/10 hover:text-black/40 dark:bg-white/10 dark:hover:text-[#D5D5D5]/50"
                    }`}
            >
                <FontAwesomeIcon icon={faCheck} className="size-2" />
            </button>
            <span className="w-20 shrink-0 text-xs font-bold text-black/70 transition-colors group-hover:text-black dark:text-[#D5D5D5]/65 dark:group-hover:text-[#3BF4C7]">
                {code}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm leading-snug text-black dark:text-[#D5D5D5]">
                {displayName}
            </span>
            <button
                type="button"
                onClick={handleDownload}
                aria-label="Download syllabus"
                className="ec-icon-button inline-flex size-7 shrink-0 items-center justify-center rounded text-black/55 hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:bg-white/5 dark:hover:text-[#3BF4C7]"
            >
                <FontAwesomeIcon icon={faDownload} className="size-3" />
            </button>
        </Link>
    );
});

type SyllabusFuseRecord = {
    code: string;
    title: string;
    syllabus: SyllabusItem;
};

const INITIAL_VISIBLE_COUNT = 48;
const LOAD_MORE_STEP = 48;

// Debounce before reporting a settled search so a single query fires one
// analytics event rather than one per keystroke.
const SEARCH_REPORT_DELAY_MS = 600;

export default function SyllabusGrid({ syllabi }: { syllabi: SyllabusItem[] }) {
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
    const inputRef = useRef<HTMLInputElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const { prefetch } = useRouter();
    const { toast } = useToast();

    // Search-analytics bookkeeping. `hasInteracted` gates reporting until the
    // user actually types; `pendingSearch` holds the last result-bearing query
    // the user was looking at (fired as "abandoned" if they leave without
    // clicking); `converted` records that a result was opened so leaving no
    // longer counts as abandonment; the last-query refs de-duplicate events.
    const hasInteracted = useRef(false);
    const pendingSearch = useRef<{ query: string; resultCount: number } | null>(
        null,
    );
    const converted = useRef(false);
    const lastNoResultQuery = useRef<string | null>(null);
    const lastAbandonedQuery = useRef<string | null>(null);

    const prefetchHref = useCallback(
        (href: string) => {
            prefetch(href);
        },
        [prefetch],
    );

    // Report the last result-bearing query as abandoned when the user leaves the
    // search without opening a result. No-op if they converted or if it was
    // already reported.
    const flushAbandoned = useCallback(() => {
        const pending = pendingSearch.current;
        pendingSearch.current = null;
        if (!pending || converted.current) return;
        if (lastAbandonedQuery.current === pending.query) return;
        lastAbandonedQuery.current = pending.query;
        captureCourseSearchAbandoned({
            context: "syllabus",
            query: pending.query,
            resultCount: pending.resultCount,
        });
    }, []);

    const syllabusById = useMemo(
        () => new Map(syllabi.map((syllabus) => [syllabus.id, syllabus])),
        [syllabi],
    );

    // Shared fuzzy searcher (same weights/threshold as the homepage, notes, and
    // past-papers surfaces) so typos like "mulyi" still surface Multivariable
    // Calculus instead of dead-ending on the old exact-substring filter.
    const courseFuse = useMemo(() => {
        const records: SyllabusFuseRecord[] = syllabi.map((syllabus) => {
            const parsed = parseSyllabusName(syllabus.name);
            return {
                code: parsed.courseCode ?? syllabus.name.split("_")[0] ?? "",
                title: parsed.courseName ?? formatSyllabusDisplayName(syllabus.name),
                syllabus,
            };
        });
        return createCourseFuse(records);
    }, [syllabi]);

    // Rank matches by the searcher's score so the 48-row window holds the best
    // matches, not the alphabetically-first ones the old in-place filter kept.
    const filtered = useMemo(() => {
        const trimmed = query.trim();
        if (!trimmed) return syllabi;
        return courseFuse.search(trimmed).map((result) => result.item.syllabus);
    }, [query, syllabi, courseFuse]);

    // Reset the window synchronously whenever the result set changes (e.g. on
    // search) — doing this during render (rather than in an effect) means the
    // new results are never committed with a stale, large visibleCount, which
    // would briefly mount hundreds of rows and recreate the main-thread stall.
    const [windowedQuery, setWindowedQuery] = useState(query);
    if (windowedQuery !== query) {
        setWindowedQuery(query);
        setVisibleCount(INITIAL_VISIBLE_COUNT);
    }

    // Only render a window of the (possibly huge) result set so the main thread
    // isn't blocked hydrating thousands of rows at once. More rows reveal as the
    // sentinel scrolls into view.
    const visible = useMemo(
        () => filtered.slice(0, visibleCount),
        [filtered, visibleCount],
    );
    const hasMore = visibleCount < filtered.length;

    useEffect(() => {
        if (!hasMore) return;
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        // Environments without IntersectionObserver (older embedded WebViews)
        // can't lazily reveal rows, so fall back to rendering everything rather
        // than leaving the catalog truncated at the initial window.
        if (typeof IntersectionObserver === "undefined") {
            setVisibleCount(filtered.length);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setVisibleCount((prev) => prev + LOAD_MORE_STEP);
                }
            },
            { rootMargin: "600px 0px" },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, visible.length, filtered.length]);

    // Report a settled search once it stops changing: fire
    // `course_search_no_results` on empty results (this surface previously
    // emitted nothing, so failed syllabus searches were invisible), and remember
    // a result-bearing query so it can be flagged abandoned if the user leaves
    // without opening anything.
    useEffect(() => {
        if (!hasInteracted.current) return;
        const trimmed = query.trim();

        const timeoutId = window.setTimeout(() => {
            if (!trimmed) {
                flushAbandoned();
                return;
            }
            if (filtered.length === 0) {
                pendingSearch.current = null;
                if (trimmed.length >= 2 && lastNoResultQuery.current !== trimmed) {
                    lastNoResultQuery.current = trimmed;
                    captureCourseSearchNoResults({
                        context: "syllabus",
                        query: trimmed,
                    });
                }
                return;
            }
            // Results present: track as the active search. Refining from one
            // result-bearing query to another just replaces this (no event);
            // only leaving the search entirely reports abandonment.
            pendingSearch.current = {
                query: trimmed,
                resultCount: filtered.length,
            };
            lastAbandonedQuery.current = null;
        }, SEARCH_REPORT_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    }, [query, filtered, flushAbandoned]);

    // Flush a pending abandonment when the user leaves the page (tab close /
    // client navigation away) so a give-up that never clears the box still
    // reports.
    useEffect(() => {
        window.addEventListener("pagehide", flushAbandoned);
        return () => {
            window.removeEventListener("pagehide", flushAbandoned);
            flushAbandoned();
        };
    }, [flushAbandoned]);

    const clear = () => {
        flushAbandoned();
        setQuery("");
        inputRef.current?.focus();
    };

    const toggle = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => setSelected(new Set()), []);

    const markSearchConverted = useCallback(() => {
        if (!query.trim()) return false;
        converted.current = true;
        pendingSearch.current = null;
        return true;
    }, [query]);

    // Opening a syllabus from a search: record the click (the positive signal the
    // abandoned event is measured against) and mark the search converted so
    // leaving no longer counts as abandonment. Only search-driven clicks count —
    // browsing the full catalog without a query is not a search result.
    const recordSearchConversion = useCallback(
        (id: string, interaction: CourseSearchInteraction) => {
            if (!markSearchConverted()) return;

            const syllabus = syllabusById.get(id);
            const courseCode = syllabus
                ? parseSyllabusName(syllabus.name).courseCode ??
                  syllabus.name.split("_")[0] ??
                  ""
                : "";
            const resultIndex = filtered.findIndex((s) => s.id === id);

            captureCourseSearchSelection({
                context: "syllabus",
                interaction,
                courseCode,
                resultCount: filtered.length,
                resultIndex: resultIndex >= 0 ? resultIndex : undefined,
                paperCount: 0,
                noteCount: 0,
                hasSyllabus: true,
            });
        },
        [filtered, markSearchConverted, syllabusById],
    );

    const handleSelect = useCallback(
        (id: string) => recordSearchConversion(id, "click"),
        [recordSearchConversion],
    );

    const downloadSyllabus = useCallback(
        (id: string) => {
            const syllabus = syllabusById.get(id);
            if (!syllabus) return;

            recordSearchConversion(id, "download");

            void downloadPdfFile({
                fileUrl: syllabus.fileUrl,
                fileName: getSyllabusFileName(syllabus),
            });
        },
        [recordSearchConversion, syllabusById],
    );

    const downloadSelected = useCallback(async () => {
        if (isDownloading) return;

        const selectedSyllabi = Array.from(selected)
            .map((id) => syllabusById.get(id))
            .filter((syllabus): syllabus is SyllabusItem => Boolean(syllabus));

        if (!selectedSyllabi.length) return;

        setIsDownloading(true);
        try {
            await downloadPdfZip({
                zipFileName: buildSyllabusZipFileName(),
                files: selectedSyllabi.map((syllabus) => ({
                    fileUrl: syllabus.fileUrl,
                    fileName: getSyllabusFileName(syllabus),
                })),
            });
            markSearchConverted();
        } catch {
            toast({
                title: "Could not create the syllabus zip file.",
                variant: "destructive",
            });
        } finally {
            setIsDownloading(false);
        }
    }, [isDownloading, markSearchConverted, selected, syllabusById, toast]);

    const count = selected.size;

    return (
        <div className="flex flex-col gap-5">
            <div className="relative flex h-12 w-full items-center border border-black/25 bg-white px-2 dark:border-[#D5D5D5]/30 dark:bg-[#3D414E]">
                <Image src={SearchIcon} alt="search" className="dark:invert-[.835]" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onFocus={() => void initializePostHogClient()}
                        onChange={(e) => {
                            if (!hasInteracted.current) {
                                void initializePostHogClient();
                            }
                            hasInteracted.current = true;
                            converted.current = false;
                            setQuery(e.target.value);
                        }}
                        aria-label="Search syllabus"
                        placeholder="Search by code or name..."
                        className="h-full min-w-0 flex-1 bg-transparent px-4 py-0 text-sm text-black placeholder:text-black/50 outline-none focus:outline-none focus-visible:outline-none sm:text-base dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/60"
                    autoComplete="off"
                    spellCheck={false}
                />
                {query && (
                    <button
                        onClick={clear}
                        type="button"
                        aria-label="Clear search"
                        className="inline-flex size-7 items-center justify-center text-black/60 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                    >
                        <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M1 1L13 13M13 1L1 13" />
                        </svg>
                    </button>
                )}
            </div>

            {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-black/40 dark:text-[#D5D5D5]/40">
                    No syllabi match &ldquo;{query}&rdquo;
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {query && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-black/35 dark:text-[#D5D5D5]/35">
                            {filtered.length} result{filtered.length === 1 ? "" : "s"}
                        </p>
                    )}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {visible.map((s) => (
                            <SyllabusRow
                                key={s.id}
                                syllabus={s}
                                selected={selected.has(s.id)}
                                onToggleSelect={toggle}
                                onDownload={downloadSyllabus}
                                onPrefetch={prefetchHref}
                                onSelect={handleSelect}
                            />
                        ))}
                    </div>
                    {hasMore && (
                        <div
                            ref={sentinelRef}
                            aria-hidden="true"
                            className="h-8 w-full"
                        />
                    )}
                </div>
            )}
            {count > 0 && (
                <div
                    role="region"
                    aria-label="Syllabus selection toolbar"
                    className="fixed inset-x-0 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-40 flex justify-center px-3 sm:bottom-4"
                >
                    <div className="flex items-center gap-2 rounded-md border border-black/15 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]/95">
                        <span className="text-xs font-semibold text-black dark:text-[#D5D5D5] sm:text-sm">
                            {count} selected
                        </span>
                        <button
                            type="button"
                            onClick={downloadSelected}
                            disabled={isDownloading}
                            className="inline-flex h-8 items-center gap-1.5 rounded border border-black/20 bg-[#5FC4E7]/90 px-3 text-xs font-semibold text-black transition hover:bg-[#5FC4E7] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#3BF4C7]/40 dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7] dark:hover:bg-[#3BF4C7]/30 sm:text-sm"
                        >
                            <FontAwesomeIcon icon={faDownload} className="size-3" />
                            {isDownloading ? "Zipping..." : "Download"}
                        </button>
                        <button
                            type="button"
                            onClick={clearSelection}
                            aria-label="Clear selection"
                            className="inline-flex size-8 items-center justify-center rounded text-black/50 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/50 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                        >
                            <FontAwesomeIcon icon={faXmark} className="size-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
