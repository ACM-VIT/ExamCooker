"use client";

import {
  ArrowDown,
  ArrowUp,
  Pencil,
  RotateCcw,
  RotateCw,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useScroll } from "@embedpdf/plugin-scroll/react";
import { updatePastPaperPageEdits } from "@/app/actions/update-past-paper-page-edits";
import { useGuestPrompt } from "@/app/components/auth-gate";
import ModeratorPrimaryButton from "@/app/components/moderation/moderator-primary-button";
import PdfPageThumbnail from "@/app/components/moderation/pdf-page-thumbnail";
import { useToast } from "@/app/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  arePdfPageEditsEqual,
  getPdfPageDisplayEntries,
  hasPdfPageEdits,
  normalizePdfPageEdits,
  serializePdfPageEdits,
  type PdfPageDisplayEntry,
  type PdfPageEdits,
  type PdfPageRotation,
} from "@/lib/pdf/page-edits";

type PastPaperPageEditorProps = {
  className?: string;
  documentId: string;
  onSaved: (nextPageEdits: PdfPageEdits | null) => void;
  paperId: string;
  savedPageEdits: PdfPageEdits | null;
  totalPages: number;
};

type PageEditorDraftState = {
  propKey: string;
  baseline: PdfPageEdits | null;
  draft: PdfPageEdits | null;
};

type PageEditsUpdate =
  | PdfPageEdits
  | null
  | ((currentPageEdits: PdfPageEdits | null) => PdfPageEdits | null);

const SECONDARY_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1 border border-black/15 bg-white px-2.5 text-[11px] font-semibold text-black transition-all duration-150 ease-out hover:-translate-y-px hover:border-black/35 hover:bg-black/[0.03] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.85)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/55 dark:hover:bg-white/[0.04] dark:hover:text-[#3BF4C7] dark:hover:shadow-[0_2px_0_0_rgba(59,244,199,0.45)]";

const ICON_BUTTON_CLASS =
  "inline-flex size-7 items-center justify-center border border-black/15 bg-white text-black/70 transition-all duration-150 ease-out hover:-translate-y-px hover:border-black/40 hover:bg-black/[0.04] hover:text-black hover:shadow-[0_2px_0_0_rgba(0,0,0,0.85)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/65 dark:hover:border-[#3BF4C7]/55 dark:hover:bg-white/[0.05] dark:hover:text-[#3BF4C7] dark:hover:shadow-[0_2px_0_0_rgba(59,244,199,0.4)]";

const COLLAPSED_TRIGGER_CLASS =
  "inline-flex size-8 items-center justify-center border border-black/15 bg-white text-black/65 shadow-[0_2px_0_0_rgba(0,0,0,0.12)] transition-all duration-150 ease-out hover:-translate-y-px hover:border-black/40 hover:bg-black/[0.03] hover:text-black hover:shadow-[0_3px_0_0_rgba(0,0,0,0.85)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/55 dark:shadow-[0_2px_0_0_rgba(213,213,213,0.12)] dark:hover:border-[#3BF4C7]/55 dark:hover:bg-white/[0.04] dark:hover:text-[#3BF4C7] dark:hover:shadow-[0_3px_0_0_rgba(59,244,199,0.45)]";

function rotatePage(
  currentRotation: PdfPageRotation,
  delta: -90 | 90,
): PdfPageRotation {
  const nextRotation = ((currentRotation + delta) % 360 + 360) % 360;
  switch (nextRotation) {
    case 90:
    case 180:
    case 270:
      return nextRotation;
    case 0:
      return 0;
    default:
      return 0;
  }
}

function describeRotation(rotation: PdfPageRotation) {
  return rotation === 0 ? null : `${rotation}°`;
}

function swapDisplayIndexes(
  edits: PdfPageEdits | null,
  displayIndex: number,
  nextDisplayIndex: number,
  totalPages: number,
) {
  if (
    displayIndex < 0 ||
    nextDisplayIndex < 0 ||
    displayIndex >= totalPages ||
    nextDisplayIndex >= totalPages
  ) {
    return edits;
  }

  const entries = getPdfPageDisplayEntries(totalPages, edits);
  const nextOrder = entries.map((entry) => entry.originalIndex);
  const currentEntry = nextOrder[displayIndex];
  nextOrder[displayIndex] = nextOrder[nextDisplayIndex];
  nextOrder[nextDisplayIndex] = currentEntry;

  return normalizePdfPageEdits(
    {
      pageOrder: nextOrder,
      pageRotations: edits?.pageRotations ?? null,
    },
    totalPages,
  );
}

function setPageRotation(
  edits: PdfPageEdits | null,
  originalIndex: number,
  nextRotation: PdfPageRotation,
  totalPages: number,
) {
  const nextRotations = {
    ...(edits?.pageRotations ?? {}),
  };

  if (nextRotation === 0) {
    delete nextRotations[String(originalIndex)];
  } else {
    nextRotations[String(originalIndex)] = nextRotation;
  }

  return normalizePdfPageEdits(
    {
      pageOrder: edits?.pageOrder ?? null,
      pageRotations: nextRotations,
    },
    totalPages,
  );
}

export default function PastPaperPageEditor({
  className,
  documentId,
  onSaved,
  paperId,
  savedPageEdits,
  totalPages,
}: PastPaperPageEditorProps) {
  const { refresh } = useRouter();
  const { toast } = useToast();
  const { session, status } = useGuestPrompt();
  const { provides: scrollControls, state: scrollState } = useScroll(documentId);
  const isModerator = session?.user?.role === "MODERATOR";
  const normalizedSavedPageEdits = useMemo(
    () => normalizePdfPageEdits(savedPageEdits, totalPages),
    [savedPageEdits, totalPages],
  );
  const normalizedSavedKey = useMemo(
    () => serializePdfPageEdits(normalizedSavedPageEdits, totalPages),
    [normalizedSavedPageEdits, totalPages],
  );
  const [pageEditState, setPageEditState] = useState<PageEditorDraftState>({
    propKey: normalizedSavedKey,
    baseline: normalizedSavedPageEdits,
    draft: normalizedSavedPageEdits,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const baselinePageEdits =
    pageEditState.propKey === normalizedSavedKey
      ? pageEditState.baseline
      : normalizedSavedPageEdits;
  const draftPageEdits =
    pageEditState.propKey === normalizedSavedKey
      ? pageEditState.draft
      : normalizedSavedPageEdits;
  const setDraftPageEdits = (nextDraft: PageEditsUpdate) => {
    setPageEditState((currentState) => {
      const currentBaseline =
        currentState.propKey === normalizedSavedKey
          ? currentState.baseline
          : normalizedSavedPageEdits;
      const currentDraft =
        currentState.propKey === normalizedSavedKey
          ? currentState.draft
          : normalizedSavedPageEdits;

      return {
        propKey: normalizedSavedKey,
        baseline: currentBaseline,
        draft:
          typeof nextDraft === "function" ? nextDraft(currentDraft) : nextDraft,
      };
    });
  };
  const replaceSavedPageEdits = (nextSavedPageEdits: PdfPageEdits | null) => {
    const normalizedNextPageEdits = normalizePdfPageEdits(
      nextSavedPageEdits,
      totalPages,
    );

    setPageEditState({
      propKey: normalizedSavedKey,
      baseline: normalizedNextPageEdits,
      draft: normalizedNextPageEdits,
    });
  };

  const entries = useMemo(
    () => getPdfPageDisplayEntries(totalPages, draftPageEdits),
    [draftPageEdits, totalPages],
  );
  const hasChanges = useMemo(
    () =>
      !arePdfPageEditsEqual(draftPageEdits, baselinePageEdits, totalPages),
    [baselinePageEdits, draftPageEdits, totalPages],
  );
  const hasAnyEdits = hasPdfPageEdits(draftPageEdits);
  const currentDisplayPage = Math.max(scrollState.currentPage || 1, 1);

  const handleNavigateToDisplayPage = (displayIndex: number) => {
    scrollControls?.scrollToPage({
      pageNumber: displayIndex + 1,
      behavior: "smooth",
      alignX: 50,
      alignY: 0,
    });
  };

  if (status === "loading" || !isModerator || totalPages < 1) {
    return null;
  }

  const handleSave = () => {
    if (!hasChanges) {
      return;
    }

    setSaveError(null);
    startTransition(async () => {
      try {
        const response = await updatePastPaperPageEdits({
          id: paperId,
          pageEdits: draftPageEdits,
        });

        replaceSavedPageEdits(response.pageEdits ?? null);
        onSaved(response.pageEdits ?? null);
        refresh();
        toast({
          title: "Page fixes saved",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to save page fixes.";
        setSaveError(message);
        toast({
          title: message,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open page fixer"
        aria-hidden={isOpen || undefined}
        tabIndex={isOpen ? -1 : 0}
        title="Fix pages"
        className={cn(
          "absolute right-5 top-14 z-10 hidden md:inline-flex",
          isOpen
            ? "pointer-events-none opacity-0 transition-none"
            : "opacity-100 transition-opacity duration-200 delay-300",
          COLLAPSED_TRIGGER_CLASS,
        )}
      >
        <Pencil className="size-3.5" aria-hidden />
      </button>

      <div
        aria-hidden={!isOpen}
        className={cn(
          "hidden h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:block",
          isOpen ? "w-[18rem]" : "w-0",
          className,
        )}
      >
        <PageEditorPanel
          documentId={documentId}
          entries={entries}
          hasAnyEdits={hasAnyEdits}
          hasChanges={hasChanges}
          isOpen={isOpen}
          isPending={isPending}
          saveError={saveError}
          totalPages={totalPages}
          currentDisplayPage={currentDisplayPage}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
          onUndo={() => setDraftPageEdits(baselinePageEdits)}
          onReset={() => setDraftPageEdits(null)}
          onJumpToPage={handleNavigateToDisplayPage}
          onSwap={(displayIndex, nextDisplayIndex) =>
            setDraftPageEdits((currentPageEdits) =>
              swapDisplayIndexes(
                currentPageEdits,
                displayIndex,
                nextDisplayIndex,
                totalPages,
              ),
            )
          }
          onSetRotation={(originalIndex, nextRotation) =>
            setDraftPageEdits((currentPageEdits) =>
              setPageRotation(
                currentPageEdits,
                originalIndex,
                nextRotation,
                totalPages,
              ),
            )
          }
        />
      </div>
    </>
  );
}

type PageEditorPanelProps = {
  currentDisplayPage: number;
  documentId: string;
  entries: PdfPageDisplayEntry[];
  hasAnyEdits: boolean;
  hasChanges: boolean;
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onJumpToPage: (displayIndex: number) => void;
  onReset: () => void;
  onSave: () => void;
  onSetRotation: (originalIndex: number, nextRotation: PdfPageRotation) => void;
  onSwap: (displayIndex: number, nextDisplayIndex: number) => void;
  onUndo: () => void;
  saveError: string | null;
  totalPages: number;
};

function PageEditorPanel({
  currentDisplayPage,
  documentId,
  entries,
  hasAnyEdits,
  hasChanges,
  isOpen,
  isPending,
  onClose,
  onJumpToPage,
  onReset,
  onSave,
  onSetRotation,
  onSwap,
  onUndo,
  saveError,
  totalPages,
}: PageEditorPanelProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-[18rem] flex-col bg-[#C2E6EC] transition-opacity duration-300 ease-out dark:bg-[hsl(224,48%,9%)]",
        "shadow-[-12px_0_40px_-20px_rgba(15,23,42,0.25)] dark:shadow-[-12px_0_50px_-20px_rgba(0,0,0,0.6)]",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-3">
        <p className="truncate text-sm font-bold leading-tight tracking-tight text-black dark:text-[#D5D5D5]">
          Pages
          <span className="ml-1.5 text-[11px] font-normal tabular-nums text-black/40 dark:text-[#D5D5D5]/35">
            {totalPages}
          </span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close page fixer"
          title="Close"
          className="inline-flex size-7 shrink-0 items-center justify-center border border-black/15 bg-white text-black/55 shadow-[0_2px_0_0_rgba(0,0,0,0.12)] transition-all duration-150 ease-out hover:-translate-y-px hover:border-black/40 hover:bg-black/[0.04] hover:text-black hover:shadow-[0_3px_0_0_rgba(0,0,0,0.85)] focus:outline-none focus-visible:border-black/40 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/55 dark:shadow-[0_2px_0_0_rgba(213,213,213,0.12)] dark:hover:border-[#3BF4C7]/55 dark:hover:bg-white/[0.04] dark:hover:text-[#3BF4C7] dark:hover:shadow-[0_3px_0_0_rgba(59,244,199,0.45)]"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-1.5 px-3 pb-2">
        <ModeratorPrimaryButton
          onClick={onSave}
          disabled={isPending || !hasChanges}
          className="h-8 text-[11px]"
        >
          {isPending ? "Saving…" : "Save"}
        </ModeratorPrimaryButton>
        <button
          type="button"
          onClick={onUndo}
          disabled={isPending || !hasChanges}
          className={SECONDARY_BUTTON_CLASS}
          title="Discard unsaved changes"
        >
          <Undo2 className="size-3" aria-hidden />
          <span>Undo</span>
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={isPending || !hasAnyEdits}
          className={SECONDARY_BUTTON_CLASS}
          title="Reset to original"
        >
          Reset
        </button>
      </div>

      {saveError ? (
        <p className="mx-3 mb-2 shrink-0 border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-700 dark:border-red-400/40 dark:text-red-300">
          {saveError}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        <div className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <PageEntryCard
              key={`${entry.originalIndex}`}
              documentId={documentId}
              entry={entry}
              isCurrent={entry.displayIndex + 1 === currentDisplayPage}
              isPending={isPending}
              totalPages={totalPages}
              onJumpToPage={() => onJumpToPage(entry.displayIndex)}
              onMoveUp={() =>
                onSwap(entry.displayIndex, entry.displayIndex - 1)
              }
              onMoveDown={() =>
                onSwap(entry.displayIndex, entry.displayIndex + 1)
              }
              onRotateLeft={() =>
                onSetRotation(
                  entry.originalIndex,
                  rotatePage(entry.rotation, -90),
                )
              }
              onRotateRight={() =>
                onSetRotation(
                  entry.originalIndex,
                  rotatePage(entry.rotation, 90),
                )
              }
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

type PageEntryCardProps = {
  documentId: string;
  entry: PdfPageDisplayEntry;
  isCurrent: boolean;
  isPending: boolean;
  totalPages: number;
  onJumpToPage: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
};

function PageEntryCard({
  documentId,
  entry,
  isCurrent,
  isPending,
  totalPages,
  onJumpToPage,
  onMoveUp,
  onMoveDown,
  onRotateLeft,
  onRotateRight,
}: PageEntryCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const isReordered = entry.displayIndex !== entry.originalIndex;
  const rotationLabel = describeRotation(entry.rotation);

  useEffect(() => {
    if (!isCurrent || !cardRef.current) return;
    cardRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isCurrent]);

  return (
    <article
      ref={cardRef}
      className={cn(
        "border bg-white p-2 transition dark:bg-[#0C1222]",
        isCurrent
          ? "border-black dark:border-[#3BF4C7]"
          : "border-black/15 dark:border-[#D5D5D5]/15",
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onJumpToPage}
          aria-label={`Show display page ${entry.displayIndex + 1} in viewer`}
          title="Scroll to this page"
          className={cn(
            "group relative h-[78px] w-[58px] shrink-0 overflow-hidden border bg-white transition focus:outline-none focus-visible:border-black/45 dark:bg-[#09101D] dark:focus-visible:border-[#3BF4C7]/60",
            isCurrent
              ? "border-black/55 dark:border-[#3BF4C7]/55"
              : "border-black/15 hover:border-black/35 dark:border-[#D5D5D5]/15 dark:hover:border-[#3BF4C7]/45",
          )}
        >
          <PdfPageThumbnail
            documentId={documentId}
            pageIndex={entry.originalIndex}
            rotation={entry.rotation}
          />
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-bold leading-none tabular-nums text-black dark:text-[#D5D5D5]">
            {entry.displayIndex + 1}
          </p>

          {isReordered || rotationLabel ? (
            <p className="truncate text-[10px] leading-tight text-amber-700 dark:text-amber-300">
              {isReordered ? `from p.${entry.originalIndex + 1}` : null}
              {isReordered && rotationLabel ? " · " : null}
              {rotationLabel}
            </p>
          ) : null}

          <div className="mt-0.5 flex items-center gap-0.5">
            <button
              type="button"
              onClick={onRotateLeft}
              disabled={isPending}
              className={ICON_BUTTON_CLASS}
              aria-label={`Rotate source page ${entry.originalIndex + 1} left`}
              title="Rotate left"
            >
              <RotateCcw className="size-3" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onRotateRight}
              disabled={isPending}
              className={ICON_BUTTON_CLASS}
              aria-label={`Rotate source page ${entry.originalIndex + 1} right`}
              title="Rotate right"
            >
              <RotateCw className="size-3" aria-hidden />
            </button>
            <span aria-hidden className="mx-0.5 h-4 w-px bg-black/10 dark:bg-white/10" />
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isPending || entry.displayIndex === 0}
              className={ICON_BUTTON_CLASS}
              aria-label={`Move display page ${entry.displayIndex + 1} earlier`}
              title="Move up"
            >
              <ArrowUp className="size-3" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isPending || entry.displayIndex === totalPages - 1}
              className={ICON_BUTTON_CLASS}
              aria-label={`Move display page ${entry.displayIndex + 1} later`}
              title="Move down"
            >
              <ArrowDown className="size-3" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
