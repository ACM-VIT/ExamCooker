"use client";

import React, { useCallback, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faXmark } from "@fortawesome/free-solid-svg-icons";
import CoursePaperCard from "./CoursePaperCard";
import type { CoursePaperListItem } from "@/lib/data/coursePapers";

type Props = {
    papers: CoursePaperListItem[];
    courseCode: string;
    courseTitle: string;
};

export default function CoursePaperGrid({
    papers,
    courseCode,
    courseTitle,
}: Props) {
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggle = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clear = useCallback(() => setSelected(new Set()), []);

    const selectedPapers = useMemo(
        () => papers.filter((p) => selected.has(p.id)),
        [papers, selected],
    );

    const downloadSelected = useCallback(() => {
        for (const paper of selectedPapers) {
            window.open(paper.fileUrl, "_blank", "noopener,noreferrer");
        }
    }, [selectedPapers]);

    const count = selectedPapers.length;

    return (
        <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {papers.map((paper, index) => (
                    <CoursePaperCard
                        key={paper.id}
                        paper={paper}
                        courseCode={courseCode}
                        courseTitle={courseTitle}
                        index={index}
                        selected={selected.has(paper.id)}
                        onToggleSelect={toggle}
                    />
                ))}
            </div>

            {count > 0 && (
                <div
                    role="region"
                    aria-label="Selection toolbar"
                    className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-3"
                >
                    <div className="flex items-center gap-2 rounded-md border border-black/15 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]/95">
                        <span className="text-xs font-semibold text-black dark:text-[#D5D5D5] sm:text-sm">
                            {count} selected
                        </span>
                        <button
                            type="button"
                            onClick={downloadSelected}
                            className="inline-flex h-8 items-center gap-1.5 rounded border border-black/20 bg-[#5FC4E7]/90 px-3 text-xs font-semibold text-black transition hover:bg-[#5FC4E7] dark:border-[#3BF4C7]/40 dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7] dark:hover:bg-[#3BF4C7]/30 sm:text-sm"
                        >
                            <FontAwesomeIcon icon={faDownload} className="h-3 w-3" />
                            Download
                        </button>
                        <button
                            type="button"
                            onClick={clear}
                            aria-label="Clear selection"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-black/50 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/50 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                        >
                            <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
