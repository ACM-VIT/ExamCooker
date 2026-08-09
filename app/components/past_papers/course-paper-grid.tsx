"use client";

import React, { useCallback, useEffect, useEffectEvent, useMemo, useReducer, useRef } from "react";
import { OptionalViewTransition } from "@/app/components/common/react-transition";
import { createPortal } from "react-dom";
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
    captureBulkPapersDownloadCompleted,
    captureBulkPapersDownloadFailed,
    captureBulkPapersDownloadStarted,
} from "@/lib/posthog/client";
import {
    usePaperSplitView,
    type PaperSplitItem,
    type PaperSplitSide,
} from "@/app/components/past_papers/paper-split-view";
import {
    DESKTOP_SELECT_ALL_HOST_ID,
    MOBILE_SELECT_ALL_HOST_ID,
} from "./course-paper-grid-controls";

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
            <span className="flex size-4 shrink-0 items-center justify-center text-black/55 dark:text-[#D5D5D5]/60">
                {icon}
            </span>
            <span className="min-w-0 flex-1 truncate">{children}</span>
        </button>
    );
}

type SplitDragState = {
    x: number;
    y: number;
    side: PaperSplitSide | null;
    label: string;
};

type ContextMenuState = {
    paper: CoursePaperListItem;
    x: number;
    y: number;
} | null;

type CoursePaperGridState = {
    contextMenu: ContextMenuState;
    isDownloading: boolean;
    portalReady: boolean;
    selected: Set<string>;
    splitDrag: SplitDragState | null;
};

type CoursePaperGridAction =
    | { type: "toggle-selected"; id: string }
    | { type: "clear-selected" }
    | { type: "select-all"; ids: string[] }
    | { type: "reconcile-selected"; ids: string[] }
    | { type: "downloading"; value: boolean }
    | { type: "portal-ready" }
    | { type: "context-menu"; contextMenu: ContextMenuState }
    | { type: "split-drag"; splitDrag: SplitDragState | null }
    | { type: "move-split-drag"; x: number; y: number; side: PaperSplitSide | null };

const initialCoursePaperGridState: CoursePaperGridState = {
    contextMenu: null,
    isDownloading: false,
    portalReady: false,
    selected: new Set(),
    splitDrag: null,
};

function coursePaperGridReducer(
    state: CoursePaperGridState,
    action: CoursePaperGridAction,
): CoursePaperGridState {
    switch (action.type) {
        case "toggle-selected": {
            const selected = new Set(state.selected);
            if (selected.has(action.id)) selected.delete(action.id);
            else selected.add(action.id);
            return { ...state, selected };
        }
        case "clear-selected":
            return { ...state, selected: new Set() };
        case "select-all":
            return { ...state, selected: new Set(action.ids) };
        case "reconcile-selected": {
            if (state.selected.size === 0) return state;

            const selected = new Set(action.ids.filter((id) => state.selected.has(id)));
            return selected.size === state.selected.size ? state : { ...state, selected };
        }
        case "downloading":
            return { ...state, isDownloading: action.value };
        case "portal-ready":
            return { ...state, portalReady: true };
        case "context-menu":
            return { ...state, contextMenu: action.contextMenu };
        case "split-drag":
            return { ...state, splitDrag: action.splitDrag };
        case "move-split-drag":
            return state.splitDrag
                ? {
                      ...state,
                      splitDrag: {
                          ...state.splitDrag,
                          x: action.x,
                          y: action.y,
                          side: action.side,
                      },
                  }
                : state;
    }
}

export default function CoursePaperGrid({
    papers,
    courseCode,
    courseTitle,
}: Props) {
    const [{ contextMenu, isDownloading, portalReady, selected, splitDrag }, dispatch] =
        useReducer(coursePaperGridReducer, initialCoursePaperGridState);
    const splitDragPaperRef = useRef<CoursePaperListItem | null>(null);
    const splitDragSideRef = useRef<PaperSplitSide | null>(null);
    const { toast } = useToast();
    const { isSupported: splitViewSupported, openPaperSplit } = usePaperSplitView();
    const wideRemainder = papers.length % 5;
    const wideStretchClass = WIDE_STRETCH_CLASS_BY_REMAINDER[wideRemainder] ?? "";

    const toggle = useCallback((id: string) => {
        dispatch({ type: "toggle-selected", id });
    }, []);

    const clear = useCallback(() => dispatch({ type: "clear-selected" }), []);
    const closeContextMenu = useCallback(() => {
        dispatch({ type: "context-menu", contextMenu: null });
    }, []);
    const closeContextMenuFromEvent = useEffectEvent(() => {
        closeContextMenu();
    });

    const paperById = useMemo(
        () => new Map(papers.map((paper) => [paper.id, paper])),
        [papers],
    );
    const visiblePaperIds = useMemo(
        () => papers.map((paper) => paper.id),
        [papers],
    );

    const downloadSelected = useCallback(async () => {
        if (isDownloading) return;

        const selectedPapers = Array.from(selected)
            .map((id) => paperById.get(id))
            .filter((paper): paper is CoursePaperListItem => Boolean(paper));

        if (!selectedPapers.length) return;

        dispatch({ type: "downloading", value: true });
        captureBulkPapersDownloadStarted({
            courseCode,
            fileCount: selectedPapers.length,
        });
        try {
            const result = await downloadPdfZip({
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
                    pageEdits: paper.pageEdits,
                })),
            });

            captureBulkPapersDownloadCompleted({
                courseCode,
                requested: result.requested,
                succeeded: result.succeeded,
                failed: result.failed.length,
            });

            if (result.failed.length > 0) {
                toast({
                    title: `Downloaded ${result.succeeded} of ${result.requested} papers.`,
                    description:
                        "Some papers could not be fetched and were skipped from the zip.",
                });
            } else {
                toast({
                    title: `Downloaded ${result.succeeded} ${result.succeeded === 1 ? "paper" : "papers"}.`,
                });
            }
        } catch (error) {
            captureBulkPapersDownloadFailed({
                courseCode,
                requested: selectedPapers.length,
                errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
            });
            toast({
                title: "Could not create the zip file.",
                variant: "destructive",
            });
        } finally {
            dispatch({ type: "downloading", value: false });
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
            pageEdits: paper.pageEdits,
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
            dispatch({
                type: "context-menu",
                contextMenu: {
                    paper,
                    ...clampContextMenuPoint(point),
                },
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
            pageEdits: paper.pageEdits,
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
            dispatch({
                type: "split-drag",
                splitDrag: {
                    ...point,
                    side,
                    label: [
                        paper.examType ? examTypeLabel(paper.examType) : null,
                        paper.slot,
                        paper.year !== null ? String(paper.year) : null,
                    ]
                        .filter(Boolean)
                        .join(" · "),
                },
            });
        },
        [getSplitSideForPoint],
    );

    const moveSplitDrag = useCallback(
        (point: { x: number; y: number }) => {
            const side = getSplitSideForPoint(point.x);
            splitDragSideRef.current = side;
            dispatch({ type: "move-split-drag", ...point, side });
        },
        [getSplitSideForPoint],
    );

    const endSplitDrag = useCallback(
        (point: { x: number; y: number }) => {
            const paper = splitDragPaperRef.current;
            const side = splitDragSideRef.current ?? getSplitSideForPoint(point.x);

            splitDragPaperRef.current = null;
            splitDragSideRef.current = null;
            dispatch({ type: "split-drag", splitDrag: null });

            if (!paper || !side) return;
            openPaperInSplit(paper, side);
        },
        [getSplitSideForPoint, openPaperInSplit],
    );

    const cancelSplitDrag = useCallback(() => {
        splitDragPaperRef.current = null;
        splitDragSideRef.current = null;
        dispatch({ type: "split-drag", splitDrag: null });
    }, []);
    const moveSplitDragFromEvent = useEffectEvent((point: { x: number; y: number }) => {
        moveSplitDrag(point);
    });
    const endSplitDragFromEvent = useEffectEvent((point: { x: number; y: number }) => {
        endSplitDrag(point);
    });
    const cancelSplitDragFromEvent = useEffectEvent(() => {
        cancelSplitDrag();
    });

    useEffect(() => {
        dispatch({ type: "portal-ready" });
    }, []);

    useEffect(() => {
        dispatch({ type: "reconcile-selected", ids: visiblePaperIds });
    }, [visiblePaperIds]);

    useEffect(() => {
        if (!contextMenu) return;

        const closeOnOutsideInteraction = () => closeContextMenuFromEvent();
        const closeOnOutsideContextMenu = () => closeContextMenuFromEvent();
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeContextMenuFromEvent();
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
    }, [contextMenu]);

    useEffect(() => {
        if (!splitDrag) return;

        const handlePointerMove = (event: PointerEvent) => {
            moveSplitDragFromEvent({ x: event.clientX, y: event.clientY });
        };
        const handlePointerUp = (event: PointerEvent) => {
            endSplitDragFromEvent({ x: event.clientX, y: event.clientY });
        };
        const handlePointerCancel = () => {
            cancelSplitDragFromEvent();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                cancelSplitDragFromEvent();
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
    }, [splitDrag]);

    const count = selected.size;
    const allVisibleSelected =
        visiblePaperIds.length > 0 && visiblePaperIds.every((id) => selected.has(id));
    const toggleSelectAllVisible = useCallback(() => {
        if (allVisibleSelected) {
            clear();
            return;
        }

        dispatch({ type: "select-all", ids: visiblePaperIds });
    }, [allVisibleSelected, clear, visiblePaperIds]);

    const renderSelectAllButton = () => {
        if (papers.length < 2) return null;

        return (
            <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="inline-flex h-9 items-center gap-2 border border-black/15 bg-white px-3.5 text-sm font-semibold text-black transition hover:border-black/30 hover:bg-black/5 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#D5D5D5]/40 dark:hover:bg-white/5"
            >
                <Check className="size-3.5" aria-hidden />
                {allVisibleSelected ? "Clear all" : "Select all"}
            </button>
        );
    };

    const mobileSelectAllHost =
        portalReady && typeof document !== "undefined"
            ? document.getElementById(MOBILE_SELECT_ALL_HOST_ID)
            : null;
    const desktopSelectAllHost =
        portalReady && typeof document !== "undefined"
            ? document.getElementById(DESKTOP_SELECT_ALL_HOST_ID)
            : null;

    return (
        <>
            {mobileSelectAllHost
                ? createPortal(renderSelectAllButton(), mobileSelectAllHost)
                : null}
            {desktopSelectAllHost
                ? createPortal(renderSelectAllButton(), desktopSelectAllHost)
                : null}

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
                        <PanelLeft className="size-10" aria-hidden />
                    </div>
                    <div
                        className={`paper-split-drop-zone paper-split-drop-zone-right absolute inset-y-0 flex items-center justify-center border-l transition ${
                            splitDrag.side === "right"
                                ? "border-black/25 bg-[#C2E6EC]/95 text-black shadow-[inset_18px_0_44px_rgba(95,196,231,0.38)] dark:border-[#3BF4C7]/45 dark:bg-[hsl(224,48%,9%)]/95 dark:text-[#3BF4C7]"
                                : "border-black/10 bg-[#C2E6EC]/40 text-black/35 dark:border-white/10 dark:bg-[#0C1222]/35 dark:text-[#D5D5D5]/35"
                        }`}
                    >
                        <PanelRight className="size-10" aria-hidden />
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
                    tabIndex={-1}
                    aria-label="Past paper actions"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
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
                            icon={<FileText className="size-4" aria-hidden />}
                            onClick={() => openPaperPage(contextMenu.paper)}
                        >
                            Open paper page
                        </ContextMenuItem>
                        <ContextMenuItem
                            icon={<PanelLeft className="size-4" aria-hidden />}
                            disabled={!splitViewSupported}
                            onClick={() => openSplitFromContextMenu(contextMenu.paper, "left")}
                        >
                            Open in left split
                        </ContextMenuItem>
                        <ContextMenuItem
                            icon={<PanelRight className="size-4" aria-hidden />}
                            disabled={!splitViewSupported}
                            onClick={() => openSplitFromContextMenu(contextMenu.paper, "right")}
                        >
                            Open in right split
                        </ContextMenuItem>
                        <ContextMenuItem
                            icon={<ExternalLink className="size-4" aria-hidden />}
                            onClick={() => openPdfInNewTab(contextMenu.paper)}
                        >
                            Open PDF in new tab
                        </ContextMenuItem>
                        <ContextMenuItem
                            icon={<Download className="size-4" aria-hidden />}
                            onClick={() => downloadPaper(contextMenu.paper)}
                        >
                            Download paper
                        </ContextMenuItem>
                        <ContextMenuItem
                            icon={<Check className="size-4" aria-hidden />}
                            onClick={() => toggleFromContextMenu(contextMenu.paper)}
                        >
                            {selected.has(contextMenu.paper.id) ? "Deselect paper" : "Select paper"}
                        </ContextMenuItem>
                    </div>
                </div>
            )}

            <div className="course-paper-grid flex flex-wrap gap-3">
                {papers.map((paper, index) => (
                    <OptionalViewTransition
                        key={paper.id}
                        enter={{
                            "filter-results": "paper-card-enter",
                            default: "none",
                        }}
                        exit={{
                            "filter-results": "paper-card-exit",
                            default: "none",
                        }}
                        update={{
                            "filter-results": "paper-card-move",
                            default: "none",
                        }}
                        default="none"
                    >
                        <div
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
                    </OptionalViewTransition>
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
                            className="inline-flex h-8 items-center gap-1.5 rounded border border-black/20 bg-[#5FC4E7]/90 px-3 text-xs font-semibold text-black transition hover:bg-[#5FC4E7] disabled:cursor-not-allowed disabled:opacity-70 dark:border-[#3BF4C7]/40 dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7] dark:hover:bg-[#3BF4C7]/30 sm:text-sm"
                        >
                            <Download className="size-3.5" aria-hidden />
                            {isDownloading ? "Zipping..." : "Download"}
                        </button>
                        <span
                            aria-hidden
                            className="ml-1 h-5 w-px bg-black/10 dark:bg-[#D5D5D5]/15"
                        />
                        <button
                            type="button"
                            onClick={clear}
                            aria-label="Clear selection"
                            className="ml-1 inline-flex size-8 items-center justify-center rounded text-black/50 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/50 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                        >
                            <X className="size-3.5" aria-hidden />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
