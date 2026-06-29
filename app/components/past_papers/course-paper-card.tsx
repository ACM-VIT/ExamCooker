"use client";

import React, { memo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "@/app/components/common/app-image";
import {
    Check,
    Download,
    ExternalLink,
    KeyRound,
} from "lucide-react";
import { examTypeLabel } from "@/lib/exam-slug";
import { downloadPdfFile } from "@/lib/downloads/browser-downloads";
import { buildPastPaperPdfFileName } from "@/lib/downloads/resource-names";
import { preloadPdfBuffer } from "@/lib/pdf/pdf-buffer-cache";
import { preloadPdfiumEngine } from "@/lib/pdf/pdfium-engine-cache";
import type { ExamType } from "@/db";
import type { PdfPageEdits } from "@/lib/pdf/page-edits";

type Paper = {
    id: string;
    title: string;
    fileUrl: string;
    thumbNailUrl: string | null;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    hasAnswerKey: boolean;
    pageEdits: PdfPageEdits | null;
};

type Props = {
    paper: Paper;
    courseCode: string;
    courseTitle: string;
    index: number;
    selected: boolean;
    onToggleSelect: (id: string) => void;
    splitDragEnabled?: boolean;
    onSplitDragStart?: (paper: Paper, point: { x: number; y: number }) => void;
    onSplitDragMove?: (point: { x: number; y: number }) => void;
    onSplitDragEnd?: (point: { x: number; y: number }) => void;
    onSplitDragCancel?: () => void;
    onContextMenuOpen?: (paper: Paper, point: { x: number; y: number }) => void;
};

function CoursePaperCard({
    paper,
    courseCode,
    courseTitle,
    index,
    selected,
    onToggleSelect,
    splitDragEnabled = false,
    onSplitDragStart,
    onSplitDragMove,
    onSplitDragEnd,
    onSplitDragCancel,
    onContextMenuOpen,
}: Props) {
    const href = `/past_papers/${encodeURIComponent(courseCode)}/paper/${paper.id}`;
    const hasWarmedPdf = useRef(false);
    const splitDragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        dragging: boolean;
    } | null>(null);
    const suppressNextClick = useRef(false);
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

        const warm = () => {
            void preloadPdfiumEngine().catch(() => undefined);
            preloadPdfBuffer(paper.fileUrl);
        };

        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            window.requestIdleCallback(warm, { timeout: 250 });
            return;
        }

        globalThis.setTimeout(warm, 0);
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

    const resetSuppressedClick = useCallback(() => {
        window.setTimeout(() => {
            suppressNextClick.current = false;
        }, 0);
    }, []);

    const handleSplitPointerDown = useCallback((e: React.PointerEvent<HTMLAnchorElement>) => {
        if (!splitDragEnabled || e.button !== 0) return;
        const target = e.target;
        if (target instanceof HTMLElement && target.closest("button")) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        splitDragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            dragging: false,
        };
    }, [splitDragEnabled]);

    const handleSplitPointerMove = useCallback((e: React.PointerEvent<HTMLAnchorElement>) => {
        const current = splitDragRef.current;
        if (!current || current.pointerId !== e.pointerId) return;

        const deltaX = e.clientX - current.startX;
        const deltaY = e.clientY - current.startY;
        const absoluteX = Math.abs(deltaX);
        const absoluteY = Math.abs(deltaY);

        if (!current.dragging) {
            if (absoluteX < 14 && absoluteY < 14) return;
            if (absoluteX < absoluteY * 1.15) {
                splitDragRef.current = null;
                try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                    // Pointer capture may already be released after a browser gesture.
                }
                return;
            }

            current.dragging = true;
            suppressNextClick.current = true;
            handleWarmPdf();
            onSplitDragStart?.(paper, { x: e.clientX, y: e.clientY });
        }

        e.preventDefault();
        onSplitDragMove?.({ x: e.clientX, y: e.clientY });
    }, [handleWarmPdf, onSplitDragMove, onSplitDragStart, paper]);

    const handleSplitPointerUp = useCallback((e: React.PointerEvent<HTMLAnchorElement>) => {
        const current = splitDragRef.current;
        if (!current || current.pointerId !== e.pointerId) return;

        splitDragRef.current = null;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // Pointer capture may already be released after a browser gesture.
        }

        if (!current.dragging) return;

        e.preventDefault();
        onSplitDragEnd?.({ x: e.clientX, y: e.clientY });
        resetSuppressedClick();
    }, [onSplitDragEnd, resetSuppressedClick]);

    const handleSplitPointerCancel = useCallback((e: React.PointerEvent<HTMLAnchorElement>) => {
        const current = splitDragRef.current;
        if (!current || current.pointerId !== e.pointerId) return;

        splitDragRef.current = null;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // Pointer capture may already be released after a browser gesture.
        }

        if (!current.dragging) return;

        onSplitDragCancel?.();
        resetSuppressedClick();
    }, [onSplitDragCancel, resetSuppressedClick]);

    const handleClickCapture = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        if (!suppressNextClick.current) return;
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const preventNativeDrag = useCallback((e: React.DragEvent<HTMLAnchorElement>) => {
        if (!splitDragEnabled) return;
        e.preventDefault();
    }, [splitDragEnabled]);

    const handleContextMenu = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        if (!onContextMenuOpen) return;
        e.preventDefault();
        e.stopPropagation();
        onContextMenuOpen(paper, { x: e.clientX, y: e.clientY });
    }, [onContextMenuOpen, paper]);

    return (
        <article
            className={`ec-card-lift ec-press group relative isolate flex h-full flex-col border-2 p-3 text-black focus-within:outline-none focus-within:ring-2 focus-within:ring-black/70 dark:text-[#D5D5D5] dark:focus-within:ring-[#3BF4C7] ${
                splitDragEnabled ? "[touch-action:pan-y]" : ""
            } ${selected
                    ? "border-black bg-[#5FC4E7] shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:border-[#3BF4C7] dark:bg-[#0C1222] dark:shadow-[4px_4px_0_0_rgba(59,244,199,0.35)]"
                    : "border-[#5FC4E7] bg-[#5FC4E7] hover:border-b-2 hover:border-b-white dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222] dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10"
                }`}
        >
            <Link
                href={href}
                draggable={false}
                transitionTypes={["nav-forward"]}
                aria-label={linkAriaLabel}
                onClickCapture={handleClickCapture}
                onContextMenu={handleContextMenu}
                onDragStart={preventNativeDrag}
                onFocus={handleWarmPdf}
                onPointerDown={handleSplitPointerDown}
                onPointerMove={handleSplitPointerMove}
                onPointerUp={handleSplitPointerUp}
                onPointerCancel={handleSplitPointerCancel}
                onPointerEnter={handleWarmPdf}
                className="absolute inset-0 z-0"
            >
                <span className="sr-only">{linkAriaLabel}</span>
            </Link>

            <div className="pointer-events-none flex h-full flex-col">
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

                <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#d9d9d9] dark:bg-white/5">
                    <Image
                        src={paper.thumbNailUrl || "/assets/exam-cooker.png"}
                        alt={courseTitle}
                        fill
                        sizes="(min-width: 1280px) 220px, (min-width: 1024px) 25vw, (min-width: 640px) 32vw, 45vw"
                        className="ec-card-media pointer-events-none select-none object-cover"
                        draggable={false}
                        priority={index < 3}
                    />
                    {paper.hasAnswerKey && (
                        <span
                            title="Answer key included"
                            className="absolute left-1/2 top-1.5 inline-flex h-5 -translate-x-1/2 items-center gap-1 rounded bg-white/85 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-black backdrop-blur dark:bg-[#0C1222]/80 dark:text-[#3BF4C7]"
                        >
                            <KeyRound className="size-2.5" aria-hidden />
                            Key
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={handleToggleSelect}
                        aria-label={selected ? "Deselect paper" : "Select paper"}
                        aria-pressed={selected}
                        className={`ec-icon-button pointer-events-auto absolute left-1.5 top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded ${selected
                                ? "bg-[#0A0F1C] text-white dark:bg-[#3BF4C7] dark:text-[#0C1222]"
                                : "bg-white/80 text-transparent backdrop-blur hover:bg-white hover:text-black/40 dark:bg-[#0C1222]/60 dark:hover:bg-[#0C1222]"
                            }`}
                    >
                        <Check className="size-2.5" aria-hidden />
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        aria-label="Download paper"
                        className="ec-icon-button pointer-events-auto absolute right-1.5 top-1.5 z-10 inline-flex size-5 items-center justify-center rounded bg-white/80 text-black/70 backdrop-blur hover:bg-white hover:text-black dark:bg-[#0C1222]/60 dark:text-[#D5D5D5]/70 dark:hover:bg-[#0C1222] dark:hover:text-[#D5D5D5]"
                    >
                        <Download className="size-2.5" aria-hidden />
                    </button>
                </div>
            </div>

            <button
                type="button"
                onClick={handleOpenInNewTab}
                aria-label="Open paper in new tab"
                title="Open paper in new tab"
                className="ec-icon-button pointer-events-auto absolute right-2 top-2 z-10 inline-flex size-6 items-center justify-center rounded text-black/60 hover:bg-black/10 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:bg-white/10 dark:hover:text-[#D5D5D5]"
            >
                <ExternalLink className="size-3" aria-hidden />
            </button>
        </article>
    );
}

export default memo(CoursePaperCard);
