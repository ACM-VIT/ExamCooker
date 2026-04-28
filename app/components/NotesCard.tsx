"use client";

import React from "react";
import Link from "next/link";
import Image from "@/app/components/common/AppImage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faDownload } from "@fortawesome/free-solid-svg-icons";
import { stripPdfExtension } from "@/lib/pdf";

interface NotesCardProps {
    note: {
        id: string;
        title: string;
        thumbNailUrl?: string | null;
    };
    index: number;
    openInNewTab?: boolean;
    selected?: boolean;
    onToggleSelect?: (id: string) => void;
    onDownload?: (id: string) => void;
}

function NotesCard({
    note,
    index,
    openInNewTab,
    selected = false,
    onToggleSelect,
    onDownload,
}: NotesCardProps) {
    const displayTitle = stripPdfExtension(note.title);

    const handleToggleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onToggleSelect?.(note.id);
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onDownload?.(note.id);
    };

    return (
        <div className="h-full w-full max-w-sm text-black dark:text-[#D5D5D5]">
            <Link
                href={`/notes/${note.id}`}
                prefetch={index < 3}
                transitionTypes={openInNewTab ? undefined : ["nav-forward"]}
                target={openInNewTab ? "_blank" : undefined}
                className={`group block max-w-96 cursor-pointer border-2 text-center transition duration-200 hover:scale-105 hover:border-b-2 hover:border-b-[#ffffff] hover:shadow-xl dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10 lg:dark:bg-[#0C1222] ${selected
                        ? "border-black bg-[#5FC4E7] shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:border-[#3BF4C7] dark:bg-[#0C1222] dark:shadow-[4px_4px_0_0_rgba(59,244,199,0.35)]"
                        : "border-[#5FC4E7] bg-[#5FC4E7] dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10"
                    }`}
            >
                <div className="flex min-h-[4.75rem] items-start px-4 pb-2 pt-3">
                    <div className="min-w-0 flex-1 text-left">
                        <div className="line-clamp-2 w-full text-sm font-semibold leading-snug text-black dark:text-[#D5D5D5]">
                            {displayTitle}
                        </div>
                    </div>
                </div>

                <div className="relative h-44 w-full overflow-hidden bg-[#d9d9d9]">
                    <Image
                        src={note.thumbNailUrl || "/assets/ExamCooker.png"}
                        alt={displayTitle}
                        fill
                        sizes="(min-width: 1024px) 320px, (min-width: 768px) 45vw, 90vw"
                        className="object-cover"
                        priority={index < 3}
                    />
                    {onToggleSelect && (
                        <button
                            type="button"
                            onClick={handleToggleSelect}
                            aria-label={selected ? "Deselect note" : "Select note"}
                            aria-pressed={selected}
                            className={`absolute left-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded transition ${selected
                                    ? "bg-black text-white dark:bg-[#3BF4C7] dark:text-[#0C1222]"
                                    : "bg-white/80 text-transparent backdrop-blur hover:bg-white hover:text-black/40 dark:bg-[#0C1222]/60 dark:hover:bg-[#0C1222]"
                                }`}
                        >
                            <FontAwesomeIcon icon={faCheck} className="h-2 w-2" />
                        </button>
                    )}
                    {onDownload && (
                        <button
                            type="button"
                            onClick={handleDownload}
                            aria-label="Download note"
                            className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-white/80 text-black/70 backdrop-blur transition hover:bg-white hover:text-black dark:bg-[#0C1222]/60 dark:text-[#D5D5D5]/70 dark:hover:bg-[#0C1222] dark:hover:text-[#D5D5D5]"
                        >
                            <FontAwesomeIcon icon={faDownload} className="h-2.5 w-2.5" />
                        </button>
                    )}
                </div>
            </Link>
        </div>
    );
}

export default NotesCard;
