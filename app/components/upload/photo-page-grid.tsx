"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronLeft,
    faChevronRight,
    faRotateRight,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { PhotoPage } from "@/app/components/upload-form-state";
import { useObjectUrl } from "@/app/components/upload/use-object-url";

// Touch screens always show the page actions under the thumbnail with 40px
// targets. With a mouse they sit on the thumbnail and appear on hover or
// keyboard focus.
const REVEAL_ON_HOVER =
    "can-hover:opacity-0 can-hover:transition-opacity can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100";
const PAGE_ACTION_CLASS =
    "flex size-10 items-center justify-center text-sm text-black/80 transition-colors hover:bg-[#5FC4E7]/30 hover:text-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent can-hover:size-8 dark:text-[#D5D5D5]/85 dark:hover:bg-[#3BF4C7]/15 dark:hover:text-[#D5D5D5]";

function PageTile({
    disabled,
    index,
    onMove,
    onRemove,
    onRotate,
    page,
    pageCount,
}: {
    disabled: boolean;
    index: number;
    onMove: (pageId: string, delta: number) => void;
    onRemove: (pageId: string) => void;
    onRotate: (pageId: string) => void;
    page: PhotoPage;
    pageCount: number;
}) {
    const thumbnailUrl = useObjectUrl(page.processed?.thumbnail);
    const pageNumber = index + 1;
    const isProcessing = page.processed === null;

    return (
        <li className="group relative">
            <div className="relative aspect-square overflow-hidden bg-black/[0.04] ring-1 ring-black/15 dark:bg-white/5 dark:ring-white/15">
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={`Page ${pageNumber}${page.rotation ? `, turned ${page.rotation}°` : ""}`}
                        className="size-full object-contain p-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-transform duration-200"
                        style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 text-xs text-black/60 dark:text-[#D5D5D5]/60">
                        <span className="size-5 animate-spin rounded-full border-2 border-[#5FC4E7] border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
                        Processing...
                    </div>
                )}
                <span className="absolute left-1.5 top-1.5 min-w-5 bg-[#3BF4C7] px-1 text-center text-[11px] font-bold leading-5 text-black">
                    {pageNumber}
                </span>
            </div>
            <button
                type="button"
                className={`absolute right-0 top-0 flex size-10 items-center justify-center ${REVEAL_ON_HOVER}`}
                disabled={disabled}
                onClick={() => onRemove(page.id)}
                aria-label={`Remove page ${pageNumber}`}
                title="Remove page"
            >
                <span className="flex size-6 items-center justify-center rounded-full bg-black/75 text-xs text-white transition-colors hover:bg-red-600">
                    <FontAwesomeIcon icon={faXmark} />
                </span>
            </button>
            <div
                className={`mt-1 flex justify-center can-hover:absolute can-hover:inset-x-0 can-hover:bottom-0 can-hover:mt-0 can-hover:bg-white/90 can-hover:dark:bg-[#0C1222]/90 ${REVEAL_ON_HOVER}`}
            >
                <button
                    type="button"
                    className={PAGE_ACTION_CLASS}
                    disabled={disabled || index === 0}
                    onClick={() => onMove(page.id, -1)}
                    aria-label={`Move page ${pageNumber} earlier`}
                    title="Move earlier"
                >
                    <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <button
                    type="button"
                    className={PAGE_ACTION_CLASS}
                    disabled={disabled || isProcessing}
                    onClick={() => onRotate(page.id)}
                    aria-label={`Rotate page ${pageNumber}`}
                    title="Rotate 90°"
                >
                    <FontAwesomeIcon icon={faRotateRight} />
                </button>
                <button
                    type="button"
                    className={PAGE_ACTION_CLASS}
                    disabled={disabled || index === pageCount - 1}
                    onClick={() => onMove(page.id, 1)}
                    aria-label={`Move page ${pageNumber} later`}
                    title="Move later"
                >
                    <FontAwesomeIcon icon={faChevronRight} />
                </button>
            </div>
        </li>
    );
}

export default function PhotoPageGrid({
    disabled = false,
    label,
    onMove,
    onRemove,
    onRotate,
    pages,
}: {
    disabled?: boolean;
    label: string;
    onMove: (pageId: string, delta: number) => void;
    onRemove: (pageId: string) => void;
    onRotate: (pageId: string) => void;
    pages: PhotoPage[];
}) {
    return (
        <ol className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 can-hover:gap-y-3" aria-label={label}>
            {pages.map((page, index) => (
                <PageTile
                    key={page.id}
                    disabled={disabled}
                    index={index}
                    onMove={onMove}
                    onRemove={onRemove}
                    onRotate={onRotate}
                    page={page}
                    pageCount={pages.length}
                />
            ))}
        </ol>
    );
}
