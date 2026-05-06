"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
    ExternalLink,
    GripVertical,
    PanelLeft,
    PanelRight,
    X,
} from "lucide-react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";

const PDFViewerClient = dynamic(
    () => import("@/app/components/pdf-viewer-client"),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full items-center justify-center bg-gray-100 text-sm font-semibold text-gray-500 dark:bg-gray-950 dark:text-gray-300">
                Loading PDF
            </div>
        ),
    },
);

export type PaperSplitSide = "left" | "right";

export type PaperSplitItem = {
    id: string;
    title: string;
    href: string;
    fileUrl: string;
    fileName: string;
    courseCode: string;
    courseTitle: string;
    meta: string[];
};

type PaperSplitContextValue = {
    activePaper: PaperSplitItem | null;
    isSupported: boolean;
    side: PaperSplitSide;
    openPaperSplit: (paper: PaperSplitItem, side: PaperSplitSide) => void;
    closePaperSplit: () => void;
};

const PaperSplitContext = createContext<PaperSplitContextValue | null>(null);

const STORAGE_WIDTH_KEY = "ec:paperSplitWidth";
const STORAGE_SIDE_KEY = "ec:paperSplitSide";
const MIN_TABLET_PANEL_WIDTH = 320;
const MIN_DESKTOP_PANEL_WIDTH = 360;

function getViewportWidth() {
    return typeof window === "undefined" ? 1280 : window.innerWidth;
}

function getMinimumWidth(viewportWidth: number) {
    return viewportWidth < 1024 ? MIN_TABLET_PANEL_WIDTH : MIN_DESKTOP_PANEL_WIDTH;
}

function clampPanelWidth(width: number, viewportWidth = getViewportWidth()) {
    const minWidth = Math.min(getMinimumWidth(viewportWidth), viewportWidth * 0.48);
    const maxWidth = Math.max(minWidth, viewportWidth * 0.68);
    return Math.round(Math.min(Math.max(width, minWidth), maxWidth));
}

function getDefaultPanelWidth(viewportWidth = getViewportWidth()) {
    return clampPanelWidth(viewportWidth * 0.46, viewportWidth);
}

function readStoredSide(): PaperSplitSide {
    if (typeof window === "undefined") return "right";
    return window.localStorage.getItem(STORAGE_SIDE_KEY) === "left" ? "left" : "right";
}

function readStoredWidth(): number {
    if (typeof window === "undefined") return getDefaultPanelWidth();

    const stored = Number(window.localStorage.getItem(STORAGE_WIDTH_KEY));
    return Number.isFinite(stored) && stored > 0
        ? clampPanelWidth(stored)
        : getDefaultPanelWidth();
}

function PaperSplitPanel({
    paper,
    side,
    width,
    onClose,
    onMove,
    onResize,
}: {
    paper: PaperSplitItem;
    side: PaperSplitSide;
    width: number;
    onClose: () => void;
    onMove: (side: PaperSplitSide) => void;
    onResize: (width: number) => void;
}) {
    const resizeState = useRef<{
        startX: number;
        startWidth: number;
        side: PaperSplitSide;
    } | null>(null);
    const isLeft = side === "left";

    const beginResize = useCallback(
        (event: ReactPointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            resizeState.current = {
                startX: event.clientX,
                startWidth: width,
                side,
            };
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
        },
        [side, width],
    );

    const continueResize = useCallback(
        (event: ReactPointerEvent<HTMLButtonElement>) => {
            const current = resizeState.current;
            if (!current) return;

            const delta =
                current.side === "left"
                    ? event.clientX - current.startX
                    : current.startX - event.clientX;
            onResize(clampPanelWidth(current.startWidth + delta));
        },
        [onResize],
    );

    const endResize = useCallback(
        (event: ReactPointerEvent<HTMLButtonElement>) => {
            if (!resizeState.current) return;
            resizeState.current = null;
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
                // The pointer may already be released by the browser.
            }
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        },
        [],
    );

    const resizeWithKeyboard = useCallback(
        (event: KeyboardEvent<HTMLButtonElement>) => {
            const increment = event.shiftKey ? 48 : 24;
            const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
            if (direction === 0) return;

            event.preventDefault();
            const signedIncrement = isLeft ? direction * increment : -direction * increment;
            onResize(clampPanelWidth(width + signedIncrement));
        },
        [isLeft, onResize, width],
    );

    return (
        <aside
            data-paper-split-side={side}
            aria-label="Docked past paper"
            className="paper-split-panel fixed bottom-0 top-0 z-[46] hidden min-w-0 flex-col border-black/10 bg-[#C2E6EC] p-3 text-black shadow-[0_18px_60px_rgba(15,23,42,0.18)] dark:border-[#D5D5D5]/10 dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5] dark:shadow-[0_18px_70px_rgba(0,0,0,0.45)] md:flex"
            style={{ "--paper-split-width": `${width}px` } as CSSProperties}
        >
            <button
                type="button"
                aria-label="Resize split paper pane"
                title="Resize split paper pane"
                onPointerDown={beginResize}
                onPointerMove={continueResize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onKeyDown={resizeWithKeyboard}
                className={`absolute top-0 z-10 flex h-full w-3 cursor-col-resize items-center justify-center text-black/30 transition hover:bg-[#5FC4E7]/25 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black/35 dark:text-[#D5D5D5]/35 dark:hover:bg-[#3BF4C7]/15 dark:hover:text-[#3BF4C7] dark:focus-visible:ring-[#3BF4C7]/50 ${
                    isLeft ? "-right-1.5" : "-left-1.5"
                }`}
            >
                <GripVertical className="h-5 w-5" aria-hidden />
            </button>

            <header className="flex shrink-0 items-center gap-2 pb-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-black dark:text-[#D5D5D5]">
                        {paper.courseCode}
                    </p>
                    <p className="truncate text-xs font-medium text-black/55 dark:text-[#D5D5D5]/55">
                        {[paper.courseTitle, ...paper.meta].filter(Boolean).join(" · ")}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Link
                        href={paper.href}
                        aria-label="Open paper page"
                        title="Open paper page"
                        className="inline-flex h-8 w-8 items-center justify-center border border-black/15 bg-white text-black/65 transition hover:border-black/30 hover:bg-black/5 hover:text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/65 dark:hover:border-[#D5D5D5]/30 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                    >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                    </Link>
                    <button
                        type="button"
                        onClick={() => onMove("left")}
                        aria-label="Move paper pane left"
                        title="Move paper pane left"
                        aria-pressed={isLeft}
                        className={`inline-flex h-8 w-8 items-center justify-center border transition ${
                            isLeft
                                ? "border-black/30 bg-[#5FC4E7]/45 text-black dark:border-[#3BF4C7]/45 dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]"
                                : "border-black/15 bg-white text-black/55 hover:border-black/30 hover:bg-black/5 hover:text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/55 dark:hover:border-[#D5D5D5]/30 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                        }`}
                    >
                        <PanelLeft className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove("right")}
                        aria-label="Move paper pane right"
                        title="Move paper pane right"
                        aria-pressed={!isLeft}
                        className={`inline-flex h-8 w-8 items-center justify-center border transition ${
                            !isLeft
                                ? "border-black/30 bg-[#5FC4E7]/45 text-black dark:border-[#3BF4C7]/45 dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]"
                                : "border-black/15 bg-white text-black/55 hover:border-black/30 hover:bg-black/5 hover:text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/55 dark:hover:border-[#D5D5D5]/30 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                        }`}
                    >
                        <PanelRight className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close split paper pane"
                        title="Close split paper pane"
                        className="inline-flex h-8 w-8 items-center justify-center border border-black/15 bg-white text-black/55 transition hover:border-black/30 hover:bg-black/5 hover:text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/55 dark:hover:border-[#D5D5D5]/30 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                    >
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden border border-black/15 bg-white shadow-[0_4px_28px_-14px_rgba(0,0,0,0.25)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:shadow-[0_4px_28px_-14px_rgba(0,0,0,0.6)]">
                <PDFViewerClient
                    enableQuestionMarkdown
                    fileUrl={paper.fileUrl}
                    fileName={paper.fileName}
                />
            </div>
        </aside>
    );
}

export function PaperSplitViewProvider({ children }: { children: ReactNode }) {
    const [activePaper, setActivePaper] = useState<PaperSplitItem | null>(null);
    const [side, setSide] = useState<PaperSplitSide>("right");
    const [width, setWidth] = useState(() => getDefaultPanelWidth());
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 768px)");
        const syncSupport = () => setIsSupported(mediaQuery.matches);
        syncSupport();
        mediaQuery.addEventListener("change", syncSupport);
        setSide(readStoredSide());
        setWidth(readStoredWidth());

        const syncWidth = () => {
            setWidth((currentWidth) => clampPanelWidth(currentWidth));
        };
        window.addEventListener("resize", syncWidth);

        return () => {
            mediaQuery.removeEventListener("change", syncSupport);
            window.removeEventListener("resize", syncWidth);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, []);

    useEffect(() => {
        if (!isSupported && activePaper) {
            setActivePaper(null);
        }
    }, [activePaper, isSupported]);

    const openPaperSplit = useCallback(
        (paper: PaperSplitItem, nextSide: PaperSplitSide) => {
            if (!window.matchMedia("(min-width: 768px)").matches) return;
            setActivePaper(paper);
            setSide(nextSide);
            window.localStorage.setItem(STORAGE_SIDE_KEY, nextSide);
        },
        [],
    );

    const movePaperSplit = useCallback((nextSide: PaperSplitSide) => {
        setSide(nextSide);
        window.localStorage.setItem(STORAGE_SIDE_KEY, nextSide);
    }, []);

    const resizePaperSplit = useCallback((nextWidth: number) => {
        const clampedWidth = clampPanelWidth(nextWidth);
        setWidth(clampedWidth);
        window.localStorage.setItem(STORAGE_WIDTH_KEY, String(clampedWidth));
    }, []);

    const closePaperSplit = useCallback(() => {
        setActivePaper(null);
    }, []);

    const contextValue = useMemo<PaperSplitContextValue>(
        () => ({
            activePaper,
            isSupported,
            side,
            openPaperSplit,
            closePaperSplit,
        }),
        [activePaper, closePaperSplit, isSupported, openPaperSplit, side],
    );

    return (
        <PaperSplitContext.Provider value={contextValue}>
            <div
                className="paper-split-shell min-w-0"
                data-paper-split-side={activePaper && isSupported ? side : undefined}
                style={{ "--paper-split-width": `${width}px` } as CSSProperties}
            >
                <div className="paper-split-content-frame min-w-0">
                    {children}
                </div>
            </div>
            {activePaper && isSupported ? (
                <PaperSplitPanel
                    paper={activePaper}
                    side={side}
                    width={width}
                    onClose={closePaperSplit}
                    onMove={movePaperSplit}
                    onResize={resizePaperSplit}
                />
            ) : null}
        </PaperSplitContext.Provider>
    );
}

export function usePaperSplitView() {
    const context = useContext(PaperSplitContext);
    if (!context) {
        return {
            activePaper: null,
            isSupported: false,
            side: "right" as PaperSplitSide,
            openPaperSplit: () => undefined,
            closePaperSplit: () => undefined,
        };
    }

    return context;
}
