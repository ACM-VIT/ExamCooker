"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Check,
    Download,
    ExternalLink,
    FileText,
    PanelLeft,
    PanelRight,
    X,
} from "lucide-react";
import { useToast } from "@/app/components/ui/use-toast";
import CoursePaperCard from "./course-paper-card";
import type { CoursePaperListItem } from "@/lib/data/course-papers";
import { downloadPdfFile, downloadPdfZip } from "@/lib/downloads/browser-downloads";
import {
    buildPastPaperPdfFileName,
    buildPastPaperZipFileName,
} from "@/lib/downloads/resource-names";
import { examTypeLabel } from "@/lib/exam-slug";
import {
    usePaperSplitView,
    type PaperSplitItem,
    type PaperSplitSide,
} from "@/app/components/past_papers/paper-split-view";

type Props = {
    papers: CoursePaperListItem[];
    courseCode: string;
    courseTitle: string;
};

const WIDE_STRETCH_CLASS_BY_REMAINDER: Partial<Record<number, string>> = {
    2: "xl:grow xl:max-w-[calc((100%-0.75rem)/2)]",
    3: "xl:grow xl:max-w-[calc((100%-1.5rem)/3)]",
    4: "xl:grow xl:max-w-[calc((100%-2.25rem)/4)]",
};

const CONTEXT_MENU_WIDTH = 236;
const CONTEXT_MENU_HEIGHT = 286;
const CONTEXT_MENU_MARGIN = 10;

function clampContextMenuPoint(point: { x: number; y: number }) {
    if (typeof window === "undefined") return point;

    return {
        x: Math.min(
            Math.max(point.x, CONTEXT_MENU_MARGIN),
            window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN,
        ),
        y: Math.min(
            Math.max(point.y, CONTEXT_MENU_MARGIN),
            window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_MARGIN,
        ),
    };
}

function ContextMenuItem({
    children,
    disabled = false,
    icon,
    onClick,
}: {
    children: React.ReactNode;
    disabled?: boolean;
    icon: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="flex h-9 w-full items-center gap-2 px-2.5 text-left text-sm font-semibold text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45 dark:text-[#D5D5D5] dark:hover:bg-white/5"
        >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-black/55 dark:text-[#D5D5D5]/60">
                {icon}
            </span>
            <span className="min-w-0 flex-1 truncate">{children}</span>
        </button>
    );
}

export default function CoursePaperGrid({
    papers,
    courseCode,
    courseTitle,
}: Props) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);
    const [splitDrag, setSplitDrag] = useState<{
        x: number;
        y: number;
        side: PaperSplitSide | null;
        label: string;
    } | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        paper: CoursePaperListItem;
        x: number;
        y: number;
    } | null>(null);
    const splitDragPaperRef = useRef<CoursePaperListItem | null>(null);
    const splitDragSideRef = useRef<PaperSplitSide | null>(null);
    const { toast } = useToast();
    const { isSupported: splitViewSupported, openPaperSplit } = usePaperSplitView();
    const wideRemainder = papers.length % 5;
    const wideStretchClass = WIDE_STRETCH_CLASS_BY_REMAINDER[wideRemainder] ?? "";

    const toggle = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clear = useCallback(() => setSelected(new Set()), []);
    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    const paperById = useMemo(
        () => new Map(papers.map((paper) => [paper.id, paper])),
        [papers],
    );

    const downloadSelected = useCallback(async () => {
        if (isDownloading) return;

        const selectedPapers = Array.from(selected)
            .map((id) => paperById.get(id))
            .filter((paper): paper is CoursePaperListItem => Boolean(paper));

        if (!selectedPapers.length) return;

        setIsDownloading(true);
        try {
            await downloadPdfZip({
                zipFileName: buildPastPaperZipFileName({ courseCode, courseTitle }),
                files: selectedPapers.map((paper) => ({
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
                })),
            });
        } catch {
            toast({
                title: "Could not create the zip file.",
                variant: "destructive",
            });
        } finally {
            setIsDownloading(false);
        }
    }, [courseCode, courseTitle, isDownloading, paperById, selected, toast]);

    const getPaperFileName = useCallback(
        (paper: CoursePaperListItem) =>
            buildPastPaperPdfFileName({
                courseCode,
                courseTitle,
                title: paper.title,
                examLabel: paper.examType ? examTypeLabel(paper.examType) : null,
                slot: paper.slot,
                year: paper.year,
                hasAnswerKey: paper.hasAnswerKey,
            }),
        [courseCode, courseTitle],
    );

    const buildSplitPaper = useCallback(
        (paper: CoursePaperListItem): PaperSplitItem => ({
            id: paper.id,
            title: paper.title,
            href: `/past_papers/${encodeURIComponent(courseCode)}/paper/${paper.id}`,
            fileUrl: paper.fileUrl,
            fileName: getPaperFileName(paper),
            courseCode,
            courseTitle,
            meta: [
                paper.examType ? examTypeLabel(paper.examType) : null,
                paper.slot,
                paper.year !== null ? String(paper.year) : null,
                paper.hasAnswerKey ? "Answer key" : null,
            ].filter((value): value is string => Boolean(value)),
        }),
        [courseCode, courseTitle, getPaperFileName],
    );

    const getSplitSideForPoint = useCallback((x: number): PaperSplitSide | null => {
        if (typeof window === "undefined") return null;

        return x < window.innerWidth / 2 ? "left" : "right";
    }, []);

    const openPaperInSplit = useCallback(
        (paper: CoursePaperListItem, side: PaperSplitSide) => {
            openPaperSplit(buildSplitPaper(paper), side);
        },
        [buildSplitPaper, openPaperSplit],
    );

    const openContextMenu = useCallback(
        (paper: CoursePaperListItem, point: { x: number; y: number }) => {
            setContextMenu({
                paper,
                ...clampContextMenuPoint(point),
            });
        },
        [],
    );

    const openPaperPage = useCallback((paper: CoursePaperListItem) => {
        window.location.assign(`/past_papers/${encodeURIComponent(courseCode)}/paper/${paper.id}`);
        closeContextMenu();
    }, [closeContextMenu, courseCode]);

    const openPdfInNewTab = useCallback((paper: CoursePaperListItem) => {
        window.open(paper.fileUrl, "_blank", "noopener,noreferrer");
        closeContextMenu();
    }, [closeContextMenu]);

    const downloadPaper = useCallback((paper: CoursePaperListItem) => {
        void downloadPdfFile({
            fileUrl: paper.fileUrl,
            fileName: getPaperFileName(paper),
        });
        closeContextMenu();
    }, [closeContextMenu, getPaperFileName]);

    const toggleFromContextMenu = useCallback((paper: CoursePaperListItem) => {
        toggle(paper.id);
        closeContextMenu();
    }, [closeContextMenu, toggle]);

    const openSplitFromContextMenu = useCallback(
        (paper: CoursePaperListItem, side: PaperSplitSide) => {
            openPaperInSplit(paper, side);
            closeContextMenu();
        },
        [closeContextMenu, openPaperInSplit],
    );

    const startSplitDrag = useCallback(
        (paper: CoursePaperListItem, point: { x: number; y: number }) => {
            const side = getSplitSideForPoint(point.x);
            splitDragPaperRef.current = paper;
            splitDragSideRef.current = side;
            setSplitDrag({
                ...point,
                side,
                label: [
                    paper.examType ? examTypeLabel(paper.examType) : null,
                    paper.slot,
                    paper.year !== null ? String(paper.year) : null,
                ]
                    .filter(Boolean)
                    .join(" · "),
            });
        },
        [getSplitSideForPoint],
    );

    const moveSplitDrag = useCallback(
        (point: { x: number; y: number }) => {
            const side = getSplitSideForPoint(point.x);
            splitDragSideRef.current = side;
            setSplitDrag((current) =>
                current
                    ? {
                          ...current,
                          ...point,
                          side,
                      }
                    : current,
            );
        },
        [getSplitSideForPoint],
    );

    const endSplitDrag = useCallback(
        (point: { x: number; y: number }) => {
            const paper = splitDragPaperRef.current;
            const side = splitDragSideRef.current ?? getSplitSideForPoint(point.x);

            splitDragPaperRef.current = null;
            splitDragSideRef.current = null;
            setSplitDrag(null);

            if (!paper || !side) return;
            openPaperInSplit(paper, side);
        },
        [getSplitSideForPoint, openPaperInSplit],
    );

    const cancelSplitDrag = useCallback(() => {
        splitDragPaperRef.current = null;
        splitDragSideRef.current = null;
        setSplitDrag(null);
    }, []);

    useEffect(() => {
        if (!contextMenu) return;

        const closeOnOutsideInteraction = () => closeContextMenu();
        const closeOnOutsideContextMenu = () => closeContextMenu();
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeContextMenu();
            }
        };

        window.addEventListener("click", closeOnOutsideInteraction);
        window.addEventListener("contextmenu", closeOnOutsideContextMenu, true);
        window.addEventListener("resize", closeOnOutsideInteraction);
        window.addEventListener("scroll", closeOnOutsideInteraction, true);
        window.addEventListener("keydown", closeOnEscape);

        return () => {
            window.removeEventListener("click", closeOnOutsideInteraction);
            window.removeEventListener("contextmenu", closeOnOutsideContextMenu, true);
            window.removeEventListener("resize", closeOnOutsideInteraction);
            window.removeEventListener("scroll", closeOnOutsideInteraction, true);
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [closeContextMenu, contextMenu]);

    useEffect(() => {
        if (!splitDrag) return;

        const handlePointerMove = (event: PointerEvent) => {
            moveSplitDrag({ x: event.clientX, y: event.clientY });
        };
        const handlePointerUp = (event: PointerEvent) => {
            endSplitDrag({ x: event.clientX, y: event.clientY });
        };
        const handlePointerCancel = () => {
            cancelSplitDrag();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                cancelSplitDrag();
            }
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerCancel);
        window.addEventListener("blur", handlePointerCancel);
        window.addEventListener("keydown", handleKeyDown);
        document.addEventListener("visibilitychange", handlePointerCancel);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);
            window.removeEventListener("blur", handlePointerCancel);
            window.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("visibilitychange", handlePointerCancel);
        };
    }, [cancelSplitDrag, endSplitDrag, moveSplitDrag, splitDrag]);

    const count = selected.size;

    return (
        <>
            {splitDrag && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 z-[70] hidden md:block"
                >
                    <div
                        className={`paper-split-drop-zone paper-split-drop-zone-left absolute inset-y-0 flex items-center justify-center border-r transition ${
                            splitDrag.side === "left"
                                ? "border-black/25 bg-[#C2E6EC]/95 text-black shadow-[inset_-18px_0_44px_rgba(95,196,231,0.38)] dark:border-[#3BF4C7]/45 dark:bg-[hsl(224,48%,9%)]/95 dark:text-[#3BF4C7]"
                                : "border-black/10 bg-[#C2E6EC]/40 text-black/35 dark:border-white/10 dark:bg-[#0C1222]/35 dark:text-[#D5D5D5]/35"
                        }`}
                    >
                        <PanelLeft className="h-10 w-10" aria-hidden />
                    </div>
                    <div
                        className={`paper-split-drop-zone paper-split-drop-zone-right absolute inset-y-0 flex items-center justify-center border-l transition ${
                            splitDrag.side === "right"
                                ? "border-black/25 bg-[#C2E6EC]/95 text-black shadow-[inset_18px_0_44px_rgba(95,196,231,0.38)] dark:border-[#3BF4C7]/45 dark:bg-[hsl(224,48%,9%)]/95 dark:text-[#3BF4C7]"
                                : "border-black/10 bg-[#C2E6EC]/40 text-black/35 dark:border-white/10 dark:bg-[#0C1222]/35 dark:text-[#D5D5D5]/35"
                        }`}
                    >
                        <PanelRight className="h-10 w-10" aria-hidden />
                    </div>
                    <div
                        className="absolute max-w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-md border border-black/15 bg-white/95 px-3 py-2 text-black shadow-2xl backdrop-blur dark:border-[#D5D5D5]/15 dark:bg-[#121B31]/95 dark:text-[#D5D5D5]"
                        style={{ left: splitDrag.x, top: splitDrag.y }}
                    >
                        <p className="truncate text-sm font-bold">{courseCode}</p>
                        {splitDrag.label && (
                            <p className="mt-0.5 truncate text-xs font-semibold text-black/55 dark:text-[#D5D5D5]/55">
                                {splitDrag.label}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {contextMenu && (
                <div
                    role="menu"
                    aria-label="Past paper actions"
                    onClick={(event) => event.stopPropagation()}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    className="fixed z-[80] w-[236px] border border-black/15 bg-white p-1.5 text-black shadow-[0_18px_45px_rgba(15,23,42,0.18)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <div className="border-b border-black/10 px-2.5 pb-2 pt-1.5 dark:border-[#D5D5D5]/10">
                        <p className="truncate text-xs font-bold uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/45">
                            {courseCode}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-bold">
                            {[
                                contextMenu.paper.examType ? examTypeLabel(contextMenu.paper.examType) : null,
                                contextMenu.paper.slot,
                                contextMenu.paper.year !== null ? String(contextMenu.paper.year) : null,
                            ]
                                .filter(Boolean)
                                .join(" · ") || courseTitle}
                        </p>
                    </div>
                    <div className="py-1">
                        <ContextMenuItem
                            icon={<FileText className="h-4 w-4" aria-hidden />}
                            onClick={() => openPaperPage(contextMenu.paper)}
                        >
                            Open paper page
                        </ContextMenuItem>
                        <ContextMenuItem
                            icon={<PanelLeft className="h-4 w-4" aria-hidden />}
                            disabled={!splitViewSupported}
                            onClick={() => openSplitFromContextMenu(contextMenu.paper, "left")}
                        >
                            Open in left split
                        </ContextMenuItem>
                        <ContextMenuItem
                            icon={<PanelRight className="h-4 w-4" aria-hidden />}
                            disabled={!splitViewSupported}
                            onClick={() => openSplitFromContextMenu(contextMenu.paper, "right")}
                        >
                            Open in right split
                        </ContextMenuItem>
                        <ContextMenuItem
                            icon={<ExternalLink className="h-4 w-4" aria-hidden />}
                            onClick={() => openPdfInNewTab(contextMenu.paper)}
                        >
                            Open PDF in new tab
                        </ContextMenuItem>
                        <ContextMenuItem
                            icon={<Download className="h-4 w-4" aria-hidden />}
                            onClick={() => downloadPaper(contextMenu.paper)}
                        >
                            Download paper
                        </ContextMenuItem>
                        <ContextMenuItem
                            icon={<Check className="h-4 w-4" aria-hidden />}
                            onClick={() => toggleFromContextMenu(contextMenu.paper)}
                        >
                            {selected.has(contextMenu.paper.id) ? "Deselect paper" : "Select paper"}
                        </ContextMenuItem>
                    </div>
                </div>
            )}

            <div className="course-paper-grid flex flex-wrap gap-3">
                {papers.map((paper, index) => (
                    <div
                        key={paper.id}
                        className={`course-paper-grid-item min-w-0 basis-[calc((100%-0.75rem)/2)] sm:basis-[calc((100%-1.5rem)/3)] lg:basis-[calc((100%-2.25rem)/4)] xl:basis-[calc((100%-3rem)/5)] ${wideStretchClass}`}
                    >
                        <CoursePaperCard
                            paper={paper}
                            courseCode={courseCode}
                            courseTitle={courseTitle}
                            index={index}
                            selected={selected.has(paper.id)}
                            onToggleSelect={toggle}
                            splitDragEnabled={splitViewSupported}
                            onSplitDragStart={startSplitDrag}
                            onSplitDragMove={moveSplitDrag}
                            onSplitDragEnd={endSplitDrag}
                            onSplitDragCancel={cancelSplitDrag}
                            onContextMenuOpen={openContextMenu}
                        />
                    </div>
                ))}
            </div>

            {count > 0 && (
                <div
                    role="region"
                    aria-label="Selection toolbar"
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
                            className="inline-flex h-8 items-center gap-1.5 rounded border border-black/20 bg-[#5FC4E7]/90 px-3 text-xs font-semibold text-black transition hover:bg-[#5FC4E7] dark:border-[#3BF4C7]/40 dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7] dark:hover:bg-[#3BF4C7]/30 sm:text-sm"
                        >
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            {isDownloading ? "Zipping..." : "Download"}
                        </button>
                        <button
                            type="button"
                            onClick={clear}
                            aria-label="Clear selection"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-black/50 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/50 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
