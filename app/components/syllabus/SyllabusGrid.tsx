"use client";

import React, { useCallback, useRef, useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/app/components/common/AppImage";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import { formatSyllabusDisplayName, getCourseSyllabusPath, parseSyllabusName } from "@/lib/seo";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faDownload, faXmark } from "@fortawesome/free-solid-svg-icons";
import {
    downloadPdfFile,
    downloadPdfZip,
} from "@/lib/downloads/browserDownloads";
import {
    buildSyllabusPdfFileName,
    buildSyllabusZipFileName,
} from "@/lib/downloads/resourceNames";

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

function SyllabusRow({
    syllabus,
    selected,
    onToggleSelect,
    onDownload,
}: {
    syllabus: SyllabusItem;
    selected: boolean;
    onToggleSelect: (id: string) => void;
    onDownload: (id: string) => void;
}) {
    const parsed = parseSyllabusName(syllabus.name);
    const displayName = parsed.courseName || formatSyllabusDisplayName(syllabus.name);
    const code = parsed.courseCode ?? syllabus.name.split("_")[0];
    const href = parsed.courseCode
        ? getCourseSyllabusPath(parsed.courseCode)
        : `/syllabus/${syllabus.id}`;

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
            prefetch
            transitionTypes={["nav-forward"]}
            className={`group flex min-w-0 items-center gap-3 border-2 px-3 py-2.5 transition-colors hover:border-b-white hover:bg-[#5FC4E7]/10 dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10 ${selected
                    ? "border-black bg-[#5FC4E7] dark:border-[#3BF4C7] dark:bg-[#0C1222]"
                    : "border-[#5FC4E7] bg-white dark:border-[#ffffff]/20 dark:bg-[#0C1222]"
                }`}
        >
            <button
                type="button"
                onClick={handleToggleSelect}
                aria-label={selected ? "Deselect syllabus" : "Select syllabus"}
                aria-pressed={selected}
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition ${selected
                        ? "bg-black text-white dark:bg-[#3BF4C7] dark:text-[#0C1222]"
                        : "bg-black/5 text-transparent hover:bg-black/10 hover:text-black/40 dark:bg-white/10 dark:hover:text-[#D5D5D5]/50"
                    }`}
            >
                <FontAwesomeIcon icon={faCheck} className="h-2 w-2" />
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
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-black/55 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:bg-white/5 dark:hover:text-[#3BF4C7]"
            >
                <FontAwesomeIcon icon={faDownload} className="h-3 w-3" />
            </button>
        </Link>
    );
}

function normalize(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function SyllabusGrid({ syllabi }: { syllabi: SyllabusItem[] }) {
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const syllabusById = useMemo(
        () => new Map(syllabi.map((syllabus) => [syllabus.id, syllabus])),
        [syllabi],
    );

    const filtered = useMemo(() => {
        const q = normalize(query);
        if (!q) return syllabi;
        return syllabi.filter((s) => {
            const parsed = parseSyllabusName(s.name);
            const code = normalize(parsed.courseCode ?? "");
            const name = normalize(parsed.courseName ?? formatSyllabusDisplayName(s.name));
            return code.includes(q) || name.includes(q);
        });
    }, [query, syllabi]);

    const clear = () => {
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

    const downloadSyllabus = useCallback(
        (id: string) => {
            const syllabus = syllabusById.get(id);
            if (!syllabus) return;

            void downloadPdfFile({
                fileUrl: syllabus.fileUrl,
                fileName: getSyllabusFileName(syllabus),
            });
        },
        [syllabusById],
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
        } catch {
            window.alert("Could not create the syllabus zip file. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    }, [isDownloading, selected, syllabusById]);

    const count = selected.size;

    return (
        <div className="flex flex-col gap-5">
            <div className="relative flex h-12 w-full items-center border border-black/25 bg-white px-2 dark:border-[#D5D5D5]/30 dark:bg-[#3D414E]">
                <Image src={SearchIcon} alt="search" className="dark:invert-[.835]" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
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
                        className="inline-flex h-7 w-7 items-center justify-center text-black/60 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                    >
                        <svg viewBox="0 0 14 14" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
                        {filtered.map((s) => (
                            <SyllabusRow
                                key={s.id}
                                syllabus={s}
                                selected={selected.has(s.id)}
                                onToggleSelect={toggle}
                                onDownload={downloadSyllabus}
                            />
                        ))}
                    </div>
                </div>
            )}
            {count > 0 && (
                <div
                    role="region"
                    aria-label="Syllabus selection toolbar"
                    className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-3"
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
                            <FontAwesomeIcon icon={faDownload} className="h-3 w-3" />
                            {isDownloading ? "Zipping..." : "Download"}
                        </button>
                        <button
                            type="button"
                            onClick={clearSelection}
                            aria-label="Clear selection"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-black/50 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/50 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                        >
                            <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
