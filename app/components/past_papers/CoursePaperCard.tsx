"use client";

import React, { memo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "@/app/components/common/AppImage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faDownload,
    faKey,
    faCheck,
    faArrowUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import { examTypeLabel } from "@/lib/examSlug";
import { downloadPdfFile } from "@/lib/downloads/browserDownloads";
import { buildPastPaperPdfFileName } from "@/lib/downloads/resourceNames";
import { preloadPdfBuffer } from "@/lib/pdf/pdfBufferCache";
import { preloadPdfiumEngine } from "@/lib/pdf/pdfiumEngineCache";
import type { ExamType } from "@/db";

type Paper = {
    id: string;
    title: string;
    fileUrl: string;
    thumbNailUrl: string | null;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    hasAnswerKey: boolean;
};

type Props = {
    paper: Paper;
    courseCode: string;
    courseTitle: string;
    index: number;
    selected: boolean;
    onToggleSelect: (id: string) => void;
};

function CoursePaperCard({
    paper,
    courseCode,
    courseTitle,
    index,
    selected,
    onToggleSelect,
}: Props) {
    const href = `/past_papers/${encodeURIComponent(courseCode)}/paper/${paper.id}`;
    const hasWarmedPdf = useRef(false);
    const linkAriaLabel = [
        "Open",
        paper.examType ? examTypeLabel(paper.examType) : null,
        paper.slot,
        paper.year !== null ? String(paper.year) : null,
        courseCode,
        courseTitle,
        "past paper",
        paper.hasAnswerKey ? "with answer key" : null,
    ]
        .filter(Boolean)
        .join(" ");

    const handleWarmPdf = useCallback(() => {
        if (hasWarmedPdf.current) {
            return;
        }
        hasWarmedPdf.current = true;
        void preloadPdfiumEngine().catch(() => undefined);
        preloadPdfBuffer(paper.fileUrl);
    }, [paper.fileUrl]);

    const handleToggleSelect = useCallback((e: React.MouseEvent | React.ChangeEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onToggleSelect(paper.id);
    }, [onToggleSelect, paper.id]);

    const handleDownload = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        void downloadPdfFile({
            fileUrl: paper.fileUrl,
            fileName: buildPastPaperPdfFileName({
                courseCode,
                courseTitle,
                title: paper.title,
                examLabel: paper.examType ? examTypeLabel(paper.examType) : null,
                slot: paper.slot,
                year: paper.year,
                hasAnswerKey: paper.hasAnswerKey,
            }),
        });
    }, [courseCode, courseTitle, paper]);

    const handleOpenInNewTab = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        window.open(paper.fileUrl, "_blank", "noopener,noreferrer");
    }, [paper.fileUrl]);

    return (
        <Link
            href={href}
            prefetch={index < 3}
            transitionTypes={["nav-forward"]}
            aria-label={linkAriaLabel}
            onFocus={handleWarmPdf}
            onMouseDown={handleWarmPdf}
            onPointerEnter={handleWarmPdf}
            onTouchStart={handleWarmPdf}
            className={`group relative flex h-full flex-col border-2 p-3 text-black transition duration-200 hover:scale-[1.02] hover:shadow-xl dark:text-[#D5D5D5] ${selected
                    ? "border-black bg-[#5FC4E7] shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:border-[#3BF4C7] dark:bg-[#0C1222] dark:shadow-[4px_4px_0_0_rgba(59,244,199,0.35)]"
                    : "border-[#5FC4E7] bg-[#5FC4E7] hover:border-b-2 hover:border-b-white dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222] dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10"
                }`}
        >
            {/* Metadata + title at top */}
            <div className="flex flex-col gap-1.5 pb-2 pr-6 text-black dark:text-[#D5D5D5]">
                <div className="flex flex-wrap items-center gap-1.5">
                    {paper.examType && (
                        <span className="inline-flex items-center bg-black/10 px-2 py-0.5 text-[11px] font-bold text-black/80 dark:bg-[#D5D5D5]/15 dark:text-[#D5D5D5]/90">
                            {examTypeLabel(paper.examType)}
                        </span>
                    )}
                    {paper.slot && (
                        <span className="inline-flex items-center bg-black/10 px-2 py-0.5 text-[11px] font-bold text-black/80 dark:bg-[#D5D5D5]/15 dark:text-[#D5D5D5]/90">
                            {paper.slot}
                        </span>
                    )}
                    {paper.year !== null && (
                        <span className="text-[11px] font-bold text-black/60 dark:text-[#D5D5D5]/60">
                            {paper.year}
                        </span>
                    )}
                </div>
                <div className="line-clamp-2 text-sm font-bold leading-snug">
                    {courseTitle}
                </div>
            </div>
            <button
                type="button"
                onClick={handleOpenInNewTab}
                aria-label="Open paper in new tab"
                title="Open paper in new tab"
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded text-black/60 transition hover:bg-black/10 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:bg-white/10 dark:hover:text-[#D5D5D5]"
            >
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3" />
            </button>

            {/* Thumbnail below */}
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#d9d9d9] dark:bg-white/5">
                <Image
                    src={paper.thumbNailUrl || "/assets/ExamCooker.png"}
                    alt={courseTitle}
                    fill
                    sizes="(min-width: 1280px) 220px, (min-width: 1024px) 25vw, (min-width: 640px) 32vw, 45vw"
                    className="object-cover"
                    priority={index < 3}
                />
                <button
                    type="button"
                    onClick={handleToggleSelect}
                    aria-label={selected ? "Deselect paper" : "Select paper"}
                    aria-pressed={selected}
                    className={`absolute left-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded transition ${selected
                            ? "bg-black text-white dark:bg-[#3BF4C7] dark:text-[#0C1222]"
                            : "bg-white/80 text-transparent backdrop-blur hover:bg-white hover:text-black/40 dark:bg-[#0C1222]/60 dark:hover:bg-[#0C1222]"
                        }`}
                >
                    <FontAwesomeIcon icon={faCheck} className="h-2 w-2" />
                </button>
                {paper.hasAnswerKey && (
                    <span
                        title="Answer key included"
                        className="absolute left-1/2 top-1.5 inline-flex h-5 -translate-x-1/2 items-center gap-1 rounded bg-white/85 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-black backdrop-blur dark:bg-[#0C1222]/80 dark:text-[#3BF4C7]"
                    >
                        <FontAwesomeIcon icon={faKey} className="h-2 w-2" />
                        Key
                    </span>
                )}
                <button
                    type="button"
                    onClick={handleDownload}
                    aria-label="Download paper"
                    className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-white/80 text-black/70 backdrop-blur transition hover:bg-white hover:text-black dark:bg-[#0C1222]/60 dark:text-[#D5D5D5]/70 dark:hover:bg-[#0C1222] dark:hover:text-[#D5D5D5]"
                >
                    <FontAwesomeIcon icon={faDownload} className="h-2.5 w-2.5" />
                </button>
            </div>
        </Link>
    );
}

export default memo(CoursePaperCard);
